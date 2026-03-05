from .models import File_data, User_profile, User_Project, Project, Invitation, File_version, Last_download
from . import db
from .auth import FULL_NAME_REGEX, NICKNAME_REGEX, PASSWORD_REGEX, JOB_REGEX, EMAIL_REGEX

from flask import Blueprint, request, jsonify
from flask import current_app
from flask import send_from_directory

from flask_login import login_required, current_user

from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from sqlalchemy import text, func
from sqlalchemy.orm import aliased

import os
import zipfile
import re
import bleach
import phonenumbers

views = Blueprint('views', __name__)
projects_bp = Blueprint('projects', __name__)

# helper function for multiple places
def is_user_active_member(project_id, user_id):
    return User_Project.query.filter_by(project_id=project_id, user_id=user_id, is_removed=False).first() is not None

# Members base logic start
@views.route('/api/projects/<project_id>/members', methods=['GET'])
@login_required
def members(project_id):
    # Check if the user is an active member of the project
    if not is_user_active_member(project_id, current_user.user_id):
        return jsonify({"error": "You are not an active member of this project"}), 403

    # Fetch all members of the project
    user_projects = User_Project.query.filter_by(project_id=project_id, is_removed=False).all()
    project = Project.query.get(project_id)

    project_roles = []
    current_user_role = None

    for user_project in user_projects:
        user = User_profile.query.get(user_project.user_id)
        project_roles.append({
            "id": user.user_id,
            "name": user.full_name,
            "role": user_project.role,
            "email": user.email,
            "phoneNumber": user.mobile,
            "nickname": user.nickname,
            "job": user.job,
            "nickname_id": user.nickname_id
        })
        if user.user_id == current_user.user_id:
            current_user_role = user_project.role

    if current_user_role is None:
        return jsonify({"error": "You are not a member of this project"}), 403

    return jsonify({
        "user_id": current_user.user_id,
        "current_user_role": current_user_role, 
        "project_name": project.name if project else "Unknown",
        "members": project_roles
    })
# Members base logic end


# Invite members to a project
@views.route('/api/projects/<int:project_id>/invite', methods=['POST'])
@login_required
def invite_member(project_id):
    # Check if the user is an active member of the project
    if not is_user_active_member(project_id, current_user.user_id):
        return jsonify({"error": "You are not an active member of this project"}), 403

    data = request.get_json()
    invited_email = bleach.clean(data.get('email', ""), strip=True)

    if not invited_email:
        return jsonify({"error": "At least one email is required"}), 400

    # Check if the current user has permission to invite members
    user_project = User_Project.query.filter_by(user_id=current_user.user_id, project_id=project_id).first()
    if not user_project or user_project.role not in ['admin', 'owner', 'editor']: 
        return jsonify({"error": "You don't have permission to invite members"}), 403

    # Split and clean up the emails
    email_list = [bleach.clean(email.strip(), strip=True) for email in invited_email.replace("\n", ",").split(",") if email.strip()]

    for email in email_list:
        # Check if the invited user already exists
        invited_user = User_profile.query.filter_by(email=email).first()
        
        # check if the user is already a member of the project
        if invited_user:
            existing_membership = User_Project.query.filter_by(user_id=invited_user.user_id, project_id=project_id).first()
            if existing_membership:
                if existing_membership.is_removed:
                    # Re-invite the user if they were removed
                    Invitation.query.filter_by(
                        invited_user_id=invited_user.user_id,
                        project_id=project_id,
                        status='pending'
                    ).delete(synchronize_session=False)

                    # Create a new invitation
                    new_invitation = Invitation(
                        invited_email=email,
                        invited_user_id=invited_user.user_id,
                        referrer_id=current_user.user_id,
                        project_id=project_id,
                        status='pending'
                    )
                    db.session.add(new_invitation)
                    db.session.commit()
                    return jsonify({"message": "User re-invited successfully. They need to accept the invitation."}), 200
                else:
                    return jsonify({"error": f"User {email} is already a member of this project"}), 400
            else:
                # If they weren't a member before; create an invitation
                new_invitation = Invitation(
                    invited_email=email,
                    invited_user_id=invited_user.user_id if invited_user else None,
                    referrer_id=current_user.user_id,
                    project_id=project_id,
                    status='pending'
                )
                db.session.add(new_invitation)
                db.session.commit()

                return jsonify({"message": "Invitation sent successfully"}), 200

    return jsonify({"error": "Invalid email addresses"}), 400  
# Invite members to a project end


# Change role of a member
@views.route('/api/projects/<int:project_id>/change-role', methods=['POST'])
@login_required
def change_role(project_id):
    # Check if the user is an active member of the project
    if not is_user_active_member(project_id, current_user.user_id):
        return jsonify({"error": "You are not an active member of this project"}), 403

    data = request.get_json()
    target_user_id = data.get('user_id')
    new_role = data.get('role')

    if not target_user_id or not new_role:
        return jsonify({"error": "User ID and new role are required"}), 400

    # Check if the current user has permission to change roles
    user_project = User_Project.query.filter_by(user_id=current_user.user_id, project_id=project_id).first()
    if not user_project or user_project.role not in ['admin', 'owner']:
        return jsonify({"error": "You don't have permission to change roles"}), 403

    # Fetch the target user's project membership
    target_membership = User_Project.query.filter_by(user_id=target_user_id, project_id=project_id).first()
    if not target_membership:
        return jsonify({"error": "Target user is not a member of this project"}), 404

    # Role change restrictions start
    if user_project.role == 'admin' and target_membership.role in ['admin', 'owner']:
        return jsonify({"error": "Admins cannot change roles of other admins or the owner"}), 403
    
    if new_role.lower() == 'owner':
        return jsonify({"error": "You cannot assign the Owner role."}), 403
    
    if new_role == "owner" and not current_user.is_owner:
        return jsonify({"error": "You cannot assign the Owner role."}), 403

    if user_project.role == 'owner' and target_membership.role == 'owner':
        return jsonify({"error": "Owners cannot change their own role"}), 403
    
    if user_project.role == 'admin' and new_role.lower() == 'admin':
        return jsonify({"error": "Admins cannot assign the admin role to others"}), 403
    
    if current_user.user_id == target_user_id:
        return jsonify({"error": "You cannot change your own role"}), 403 # should not be needed, but just in case

    if new_role == 'removed' and user_project.role not in ['admin', 'owner']:
        return jsonify({"error": "You don't have permission to assign the 'removed' role"}), 403 
    # Role change restrictions end

    # Update the role(s)
    target_membership.role = new_role
    db.session.commit()
    return jsonify({"message": "Role updated successfully"})
# Change role of a member end


# Remove a member from a project
@views.route('/api/projects/<int:project_id>/remove-user', methods=['POST'])
@login_required
def remove_user_from_project(project_id):
    # Check if the user is an active member of the project
    if not is_user_active_member(project_id, current_user.user_id):
        return jsonify({"error": "You are not an active member of this project"}), 403

    data = request.get_json()
    user_id_to_remove = data.get('user_id')

    if not user_id_to_remove:
        return jsonify({"error": "User ID is required"}), 400

    remover_membership = User_Project.query.filter_by(user_id=current_user.user_id, project_id=project_id).first()
    target_membership = User_Project.query.filter_by(user_id=user_id_to_remove, project_id=project_id).first()

    if not remover_membership or not target_membership:
        return jsonify({"error": "Membership not found"}), 404

    # self-removal logic
    if current_user.user_id == user_id_to_remove:
        print(f"Self-removal attempt by user {current_user.user_id} from project {project_id}")
        if remover_membership.role == 'owner':
            print("User is the owner and cannot leave the project.")
            return jsonify({"error": "Project owners cannot leave the project"}), 403
        else:
            # Mark the user as removed
            remover_membership.is_removed = True
            remover_membership.user_deleted_or_left_date = func.now()

            db.session.commit()

            print(f"User {current_user.user_id} successfully left project {project_id}")
            return jsonify({"message": "You have left the project successfully"}), 200
    # self-removal logic end


    # remove other user(s) logic start

    # Check for permissions
    if remover_membership.role not in ['admin', 'owner']:
        return jsonify({"error": "You don't have permission to remove members"}), 403

    if remover_membership.role == 'admin' and target_membership.role in ['admin', 'owner']:
        return jsonify({"error": "Admins cannot remove other admins or owners"}), 403

    if target_membership.role == 'owner':
        return jsonify({"error": "You cannot remove the owner of the project"}), 403

    # Mark the user as removed
    target_membership.is_removed = True
    target_membership.user_deleted_or_left_date = func.now()

    db.session.commit()

    return jsonify({"message": "User removed from the project successfully"}), 200
# Remove a member from a project end


# base logic for invitations start
@views.route('/invitations', methods=['GET'])
@login_required
def invitations():
    filter_status = request.args.getlist('status')  # Get the status filter from the query params
    if not filter_status:
        filter_status = ['pending']  # Default to "pending" if no status is provided

    # Fetch the latest invitations for the current user based on the filter
    latest_invites_subquery = db.session.query(
        Invitation.project_id,
        func.max(Invitation.invitation_id).label('max_id')
    ).filter(
        ((Invitation.invited_user_id == current_user.user_id) | 
         (Invitation.invited_email == current_user.email)),
        Invitation.status.in_(filter_status)  # Dynamically filter by status
    ).group_by(Invitation.project_id).subquery()

    latest_invitations = db.session.query(Invitation).join(
        latest_invites_subquery,
        (Invitation.project_id == latest_invites_subquery.c.project_id) & 
        (Invitation.invitation_id == latest_invites_subquery.c.max_id)
    ).all()

    invitations_data = []
    for inv in latest_invitations:
        referrer = User_profile.query.get(inv.referrer_id)  # Fetch the user who sent the invitation
        project_creator = User_profile.query.get(inv.project.creator_id)  # Fetch the project creator

        invitations_data.append({
            "project_name": inv.project.name,
            "id": inv.invitation_id,
            "project_id": inv.project_id,
            "status": inv.status,
            "invite_date": inv.invite_date,
            "profile_pic": f"/static/profile_pics/{referrer.profile_pic}" if referrer and referrer.profile_pic else "/static/profile_pics/default.png",  # Fixed this line
            "referrer_nickname": referrer.nickname if referrer else "Unknown",
            "referrer_nickname_id": referrer.nickname_id if referrer else "No ID"
        })

    return jsonify({"invitations": invitations_data})
# base logic for invitations end


# acceptin invitations start
@views.route('/accept_invite/<int:invitation_id>', methods=['POST'])
@login_required
def accept_invite(invitation_id):
    invitation = Invitation.query.get(invitation_id)
    if not invitation or (invitation.invited_user_id and invitation.invited_user_id != current_user.user_id) \
        or (invitation.invited_email and invitation.invited_email != current_user.email):
        return jsonify({"error": "Invalid invitation."}), 400

    existing_membership = User_Project.query.filter_by(
        user_id=current_user.user_id, 
        project_id=invitation.project_id
    ).first()

    # check if the user was removed prior or still part of the project
    if existing_membership:
        if existing_membership.role == 'removed' or existing_membership.is_removed:
            existing_membership.role = 'reader'
            existing_membership.is_removed = False
            existing_membership.user_deleted_or_left_date = None
            existing_membership.connection_date = func.now()
        else:
            return jsonify({"error": "User is already a project member."}), 400
    # If the user is not a member, add them
    else:
        new_member = User_Project(user_id=current_user.user_id, project_id=invitation.project_id, role='reader')
        db.session.add(new_member)

    # Update the invitation
    invitation.status = 'accepted'
    db.session.commit()

    return jsonify({"message": "Invitation accepted."})
# acceptin invitations end


# deny invitations start
@views.route('/deny_invite/<int:invitation_id>', methods=['POST'])
@login_required
def deny_invite(invitation_id):
    # check for the invitation
    invitation = Invitation.query.get(invitation_id)
    if not invitation or (invitation.invited_user_id and invitation.invited_user_id != current_user.user_id) \
        or (invitation.invited_email and invitation.invited_email != current_user.email):
        return jsonify({"error": "Invalid invitation."}), 400

    # Update only the latest invitation
    invitation.status = 'declined'
    db.session.commit()

    return jsonify({"message": "Invitation denied."})
# Invitations end


# allowed file types for upload logic start
def load_allowed_extensions(filepath=None):
    if filepath is None:
        filepath = os.path.join(current_app.static_folder, 'allowed_extensions.txt')
    if not os.path.exists(filepath):
        print(f"[ERROR] {filepath} not found. Using default set.")
        return {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'rar', 'tar', 'gz', '7z', 'docx', 'xlsx', 'pptx'}
    with open(filepath, "r", encoding="utf-8") as f:
        return {line.strip().lower() for line in f if line.strip()}

def allowed_file(filename):
    allowed_extensions = load_allowed_extensions()
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
# allowed file types for upload logic end

# upload base start
@views.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    print("Received file:", file.filename)

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        print("Saved to:", file_path)
        return jsonify({"message": "File uploaded successfully!", "file_name": filename})
    else:
        print("Rejected file extension:", file.filename)
        return jsonify({"error": "Invalid file type!"}), 400
#upload base end

# upload main file(s) + upload new version(s) for main file(s) start
@projects_bp.route("/api/projects/<int:project_id>/upload", methods=["POST"])
@login_required
def upload_file(project_id):
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):  
        return jsonify({"error": "Invalid file type!"}), 400

    # Get the user's role in the specific project
    user_project = User_Project.query.filter_by(
        user_id=current_user.user_id,
        project_id=project_id
    ).first()

    if not user_project:
        return jsonify({"error": "You are not a member of this project"}), 403

    if user_project.role == "reader":
        return jsonify({"error": "You don't have permission to upload files"}), 403

    # Check file size (1GB max)
    max_size = 1 * 1024 * 1024 * 1024  # 1GB in bytes
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)

    if size > max_size:
        return jsonify({"error": "File size exceeds the 1GB limit"}), 400

    project = Project.query.get_or_404(project_id)

    try:
        # get the form data and bleach it
        description = request.form.get("description", "")
        title = request.form.get("title", "")[:100]
        main_file_id_raw = request.form.get("main_file_id")
        comment = request.form.get("comment", "")[:100]
        main_file_id = int(main_file_id_raw) if main_file_id_raw and main_file_id_raw.isdigit() else None

        if main_file_id:
            # Version upload: Link to existing main file
            file_data = File_data.query.get(main_file_id)
            if not file_data:
                return jsonify({"error": "Main file not found"}), 404
        else:
            # New file upload
            if len(title) < 4:
                return jsonify({"error": "Title must be greater than 3 characters."}), 400

            # Create a new File_data entry (if necessary)
            file_data = File_data(
                project_id=project.project_id,
                description=description,
                title=title
            )
            db.session.add(file_data)
            db.session.commit()

        # Use the same folder for versioning (existing folder for the file)
        folder_name = str(file_data.file_data_id)
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(project.project_id), folder_name)

        # Check if the folder already exists, if not, create it
        if os.path.exists(upload_folder):
            print(f"Folder already exists: {upload_folder}")
        else:
            print(f"Folder does not exist. Creating: {upload_folder}")
            os.makedirs(upload_folder, exist_ok=True)

        print(f"Uploading file to: {upload_folder}")

        # Extract filename and extension
        filename = secure_filename(file.filename)
        name, ext = os.path.splitext(filename)

        # Determine the next version number
        latest_version = db.session.query(func.max(File_version.version_number)).filter(
            File_version.file_data_id == file_data.file_data_id
        ).scalar()
        version_number = (latest_version or 0) + 1

        # Stripping version number from the filename if it exists
        version_pattern = re.compile(r'(.*)_v\d+$')
        match = version_pattern.match(name)
        if match:
            name = match.group(1)

        # Construct the new filename
        new_filename = f"{name}_v{version_number}{ext}"

        # Mark old versions as not the latest
        File_version.query.filter_by(file_data_id=file_data.file_data_id, last_version=True).update({
            "last_version": False
        })
        db.session.commit()

        # Save the file with the new versioned name in the existing folder
        file_path = os.path.join(upload_folder, new_filename)
        file.save(file_path)

        # Create a new File_version entry
        version = File_version(
            version_number=version_number,
            file_name=new_filename,
            file_type=file.mimetype,
            file_size=os.path.getsize(file_path),
            last_version=True,
            comment=comment,
            file_data_id=file_data.file_data_id,
            user_id=current_user.user_id
        )
        db.session.add(version)
        db.session.commit()

        # Mark the uploaded file as downloaded for the uploader
        new_download = Last_download(
            file_data_id=file_data.file_data_id,
            version_id=version.version_id,
            user_id=current_user.user_id,
            download_date=func.now()
        )
        db.session.add(new_download)
        db.session.commit()

        # Return the list of versions for history list
        file_versions = File_version.query.filter_by(file_data_id=file_data.file_data_id).order_by(File_version.version_number.desc()).all()
        version_history = []
        for v in file_versions:
            uploader = User_profile.query.get(v.user_id)
            version_history.append({
                "version_number": v.version_number,
                "file_name": v.file_name,
                "file_size": v.file_size,
                "comment": v.comment,
                "uploader": uploader.full_name if uploader else "Unknown",  
                "uploader_pic": f"/static/profile_pics/{uploader.profile_pic}" if uploader and uploader.profile_pic else "/static/profile_pics/default.png"  # Add uploader profile picture
            })

        file_data_info = {
            "file_data_id": file_data.file_data_id,
            "title": file_data.title,
            "description": file_data.description,
            "project_id": file_data.project_id
        }

        return jsonify({
            "message": "File uploaded successfully",
            "file_data": file_data_info,
            "version_history": version_history  
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
# Upload file + create version end


# downlaod base start
@views.route('/download/<filename>')
@login_required
def download_file(filename):
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename, as_attachment=True)
    else:
        return jsonify({"error": "File not found."}), 404
# downlaod base end


# downlaod files start
@projects_bp.route("/api/projects/download", methods=["POST"])
@login_required
def download_files():
    data = request.get_json()
    selected_files = data.get("selected_files", [])

    if not selected_files:
        return jsonify({"error": "No files selected for download"}), 400

    try:
        # Collect file paths for the selected files
        file_paths = []
        for file_id in selected_files:
            if not str(file_id).isdigit():
                return jsonify({"error": f"Invalid file ID: {file_id}"}), 400

            # Fetch the file version and its associated file data
            file_version = File_version.query.get(int(file_id))
            if not file_version:
                return jsonify({"error": f"File version with ID {file_id} not found"}), 404

            file_data = File_data.query.get(file_version.file_data_id)
            if not file_data:
                return jsonify({"error": f"File data for version ID {file_id} not found"}), 404

            project_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(file_data.project_id))
            file_folder = os.path.join(project_folder, str(file_data.file_data_id))
            file_path = os.path.join(file_folder, file_version.file_name)

            if not os.path.exists(file_path):
                return jsonify({"error": f"File {file_version.file_name} not found on server"}), 404

            file_paths.append(file_path)

            existing = Last_download.query.filter_by(
                file_data_id=file_data.file_data_id,
                version_id=file_version.version_id,
                user_id=current_user.user_id
            ).first()

            if not existing:
                new_download = Last_download(
                    file_data_id=file_data.file_data_id,
                    version_id=file_version.version_id,
                    user_id=current_user.user_id,
                    download_date=func.now()
                )
                db.session.add(new_download)

            db.session.commit()

        # Create a ZIP archive of the selected files
        zip_filename = "selected_files.zip"
        zip_path = os.path.join(current_app.config['UPLOAD_FOLDER'], zip_filename)
        with zipfile.ZipFile(zip_path, "w") as zipf:
            for file_path in file_paths:
                zipf.write(file_path, os.path.basename(file_path))

        # Send the ZIP file to the user
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], zip_filename, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# downlaod files end


# Projects base start 
@views.route('/projects', methods=['POST', 'GET'])
@login_required
def projects():

    # Query projects the current user is part of, along with user and creator profile info
    creator_alias = aliased(User_profile)
    projects = db.session.query(Project, User_profile, creator_alias).\
        select_from(User_profile).\
        join(User_Project, User_Project.user_id == User_profile.user_id).\
        join(Project, Project.project_id == User_Project.project_id).\
        join(creator_alias, creator_alias.user_id == Project.creator_id).\
        filter(User_Project.user_id == current_user.user_id).\
        all()
    
    projects_data = [{
        "project_id": proj.Project.project_id,
        "name": proj.Project.name,
        "creator": proj.creator_alias.full_name,
    } for proj in projects]

    files = os.listdir(current_app.config['UPLOAD_FOLDER'])

    return jsonify({"projects": projects_data}, files=files)
# Projects base end


# Projects start
@views.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    user_projects = User_Project.query.filter_by(user_id=current_user.user_id).all()

    projects_data = []
    for user_project in user_projects:
        project = Project.query.get(user_project.project_id)

        last_version = db.session.query(File_version).join(File_data).filter(
            File_data.project_id == project.project_id
        ).order_by(File_version.upload_date.desc()).first()

        if last_version and last_version.upload_date:
            last_modified = last_version.upload_date
        else:
            last_modified = None

        projects_data.append({
            "id": project.project_id,
            "name": project.name,
            "role": user_project.role,
            "lastModified": last_modified,
            "date": project.created_date if project.created_date else None,
            "ownerName": User_profile.query.get(project.creator_id).full_name if project.creator_id else "Unknown",
            "ownerAvatar": f"/static/profile_pics/{User_profile.query.get(project.creator_id).profile_pic}" if project.creator_id else "/static/profile_pics/default.png",
            "status": "success"
        })

    return jsonify(projects_data)
# Projects end


#project page start
@views.route('/project/<int:project_id>', methods=['GET'])
@login_required
def project_page(project_id):
    try:
        membership = User_Project.query.filter_by(user_id=current_user.user_id, project_id=project_id).first()
        if not membership:
            return jsonify({"error": "Access denied: You are not a member of this project"}), 403

        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        user_id = current_user.user_id

        # Fetch all latest versions
        latest_versions = File_version.query.\
            join(File_data, File_version.file_data_id == File_data.file_data_id).\
            filter(File_data.project_id == project_id, File_version.last_version == True).\
            all()

        # Get version IDs user has downloaded
        downloaded_versions = db.session.query(Last_download.version_id).\
            filter_by(user_id=user_id).distinct().all()
        downloaded_version_ids = {vid for (vid,) in downloaded_versions}

        # Prepare file list
        files_data = []
        download_flags = {}

        # Iterate through the latest versions and prepare the response
        for file in latest_versions:
            uploader = User_profile.query.get(file.user_id)  
            downloaded = (file.user_id == user_id) or (file.version_id in downloaded_version_ids)
            files_data.append({
                "version_id": file.version_id,
                "file_data_id": file.file_data_id,
                "title": file.file_data.title,
                "file_name": file.file_name,
                "version_number": file.version_number,
                "file_size": file.file_size,
                "file_type": file.file_type,
                "upload_date": file.upload_date.isoformat() if file.upload_date else None,
                "description": file.file_data.description,
                "comment": file.comment,
                "uploader_nickname": uploader.nickname if uploader else "Unknown",
                "uploader_nickname_id": uploader.nickname_id if uploader else "No ID",
                "uploader_pic": f"/static/profile_pics/{uploader.profile_pic}" if uploader and uploader.profile_pic else "/static/profile_pics/default.png"  # Add uploader profile picture
            })
            download_flags[file.version_id] = downloaded

        # Prepare project data
        project_data = {
            "id": project.project_id,
            "name": project.name,
            "role": membership.role,
            "description": project.description,
            "created_date": project.created_date.isoformat() if project.created_date else None,
            "creator": User_profile.query.get(project.creator_id).full_name if project.creator_id else "Unknown"
        }

        return jsonify({
            "project": project_data,
            "files": files_data,
            "download_file_results": download_flags
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
#project page end


# Create project start
@projects_bp.route("/api/projects", methods=["POST"])
def create_project():
    data = request.get_json()
    name = bleach.clean(data.get("name", ""), strip=True)
    description = bleach.clean(data.get("description", ""), strip=True)

    if not name:
        return jsonify({"error": "Project name is required"}), 400

    project = Project(name=name, description=description)
    db.session.add(project)
    db.session.commit()

    return jsonify({
        "message": "Project created",
        "project": {
            "id": project.project_id,
            "description": project.description,
            "role": project.role,
            "created_at": project.created_date.isoformat()
        }
    }), 201
# Create project end


# Dropdown/history start    
@projects_bp.route("/api/files/<int:file_data_id>/versions", methods=["GET"])
@login_required
def get_file_versions(file_data_id):
    try:
        # Fetch the file data
        file_data = File_data.query.get(file_data_id)
        if not file_data:
            return jsonify({"error": "File not found"}), 404

        # Check if the user has access to the project
        project = Project.query.get(file_data.project_id)
        user_project = User_Project.query.filter_by(
            user_id=current_user.user_id,
            project_id=project.project_id
        ).first()

        if not user_project:
            return jsonify({"error": "Access denied"}), 403

        # Load all versions of the file
        versions = File_version.query.filter_by(file_data_id=file_data_id)\
            .order_by(File_version.version_number.desc()).all()

        # Fetch all downloaded versions for the current user
        downloaded_versions = db.session.query(Last_download.version_id).filter(
            Last_download.file_data_id == file_data_id,
            Last_download.user_id == current_user.user_id
        ).distinct().all()
        downloaded_version_ids = {vid for (vid,) in downloaded_versions}

        # Build the version history with the "downloaded" status
        version_history = []
        for v in versions:
            uploader = User_profile.query.get(v.user_id)
            version_history.append({
                "version_id": v.version_id,
                "version_number": v.version_number,
                "file_name": v.file_name,
                "file_size": v.file_size,
                "file_type": v.file_type,
                "upload_date": v.upload_date.isoformat() if v.upload_date else None,
                "comment": v.comment,
                "uploader_nickname": uploader.nickname if uploader else "Unknown",
                "uploader_nickname_id": uploader.nickname_id if uploader else "No ID",
                "uploader_pic": f"/static/profile_pics/{uploader.profile_pic}" if uploader and uploader.profile_pic else "/static/profile_pics/default.png",  # Added uploader's profile picture
                "downloaded": v.version_id in downloaded_version_ids
            })

        # Return the file data and version history
        return jsonify({
            "file_data_id": file_data_id,
            "title": file_data.title,
            "version_history": version_history
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
#dropdown/history end


# Get all versions for a project
@projects_bp.route("/api/projects/<int:project_id>/versions", methods=["GET"])
def get_project_versions(project_id):
    project = Project.query.get_or_404(project_id)
    file_data = File_data.query.filter_by(project_id=project.project_id).all()

    if not file_data:
        return jsonify({"error": "No files for this project"}), 404

    versions = []
    for f in file_data:
        file_versions = File_version.query.filter_by(file_data_id=f.file_data_id).all()
        for v in file_versions:
            versions.append({
                "version_id": v.version_id,
                "filename": v.file_name,
                "timestamp": v.upload_date.isoformat(),
                "file_size": v.file_size,
                "description": f.description
            })

    return jsonify(versions)
# Get all versions for a project end


# Settings start
# did not let me import this from auth.py
def is_valid_phone_number(number):  
    try:
        parsed_number = phonenumbers.parse(number)
        return phonenumbers.is_valid_number(parsed_number)
    except phonenumbers.NumberParseException:
        return False
    
# Get user data
@views.route('/api/user', methods=['GET'])
@login_required
def get_user():
    user = current_user
    user_data = {
        'email': user.email,
        'full_name': user.full_name,
        'nickname': user.nickname,
        'nickname_id': user.nickname_id,
        'mobile': user.mobile,
        'job': user.job,
        'profile_pic': user.profile_pic
    }
    return jsonify(user_data)

# Get profile pictures for dropdown
@views.route('/api/profile_pics', methods=['GET'])
@login_required
def get_profile_pics():
    profile_pics_folder = os.path.join(current_app.static_folder, 'profile_pics')
    profile_pics = [f for f in os.listdir(profile_pics_folder) if f.endswith(('.png', '.jpg', '.jpeg'))]

    if "default.png" not in profile_pics:
        profile_pics.append("default.png")
    return jsonify(profile_pics)

# settings update logic
@views.route('/api/user/update', methods=['POST'])
@login_required
def update_user():
    data = request.get_json()
    user = current_user

    # Clean and validate input data
    email = bleach.clean(data.get('email', ""), strip=True)
    full_name = bleach.clean(data.get('fullName', ""), strip=True)
    current_password = data.get('currentPassword')
    password1 = data.get('password1')
    password2 = data.get('password2')
    nickname = bleach.clean(data.get('nickname', ""), strip=True)
    mobile = bleach.clean(data.get('mobile', ""), strip=True)
    job = bleach.clean(data.get('job', ""), strip=True)
    selected_pic = bleach.clean(data.get('profilePic', ""), strip=True)

    # check email
    if email and email != user.email:
        if len(email) < 4:
            return jsonify({"error": "Email must be greater than 3 characters."}), 400
        elif not EMAIL_REGEX.match(email):
            return {"message": "Invalid email format.", "status": "error"}, 400
        elif User_profile.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists."}), 400

    # check full name
    if full_name and full_name != user.full_name:
        if len(full_name) < 2:
            return jsonify({"error": "Full name must be greater than 1 character."}), 400
        elif not FULL_NAME_REGEX.match(full_name):
            return jsonify({"error": "Full name must only contain letters, spaces, and hyphens."}), 400

    # check nickname
    if nickname and nickname != user.nickname:
        if len(nickname) < 2:
            return jsonify({"error": "Nickname must be greater than 1 character."}), 400
        elif len(nickname) > 20:  # Add upper limit check
            return jsonify({"error": "Nickname must not exceed 20 characters."}), 400
        elif not NICKNAME_REGEX.match(nickname):
            return jsonify({"error": "Nickname can only contain letters, numbers, and underscores."}), 400
    
    # check job
    if job and job != user.job:
        if len(job) < 2:
            return jsonify({"error": "Job title must be greater than 1 character."}), 400
        elif len(job) > 50:
            return jsonify({"error": "Job title must not exceed 50 characters."}), 400
        elif not JOB_REGEX.match(job):
            return jsonify({"error": "Job title can only contain letters, spaces, and hyphens."}), 400
        
    # check mobile
    if mobile and mobile != user.mobile:
        if len(mobile) < 2:
            return jsonify({"error": "Mobile number must be greater than 1 characters."}), 400
        elif not is_valid_phone_number(mobile):
            return jsonify({"error": "Invalid phone number format."}), 400

    # check password
    if password1 or password2:
        if password1 or password2:
            if not current_password:
                return jsonify({"error": "Current password is required."}), 400
            if not check_password_hash(user.password, current_password):
                return jsonify({"error": "Current password is incorrect."}), 400
        if password1 != password2:
            return jsonify({"error": "Passwords don't match."}), 400
        elif password1 and check_password_hash(user.password, password1):
            return jsonify({"error": "Password can't be the old one."}), 400
        elif not PASSWORD_REGEX.match(password1):
            return jsonify({
                "error": "Password must be at least 7 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
            }), 400

    # update user data
    if email and email != user.email:
        user.email = email
    if full_name and full_name != user.full_name:
        user.full_name = full_name
    if nickname and nickname != user.nickname:
        user.nickname = nickname
    if mobile and mobile != user.mobile:
        user.mobile = mobile
    if job and job != user.job:
        user.job = job
    if selected_pic:
        profile_pics_folder = os.path.join(current_app.static_folder, 'profile_pics')
        profile_pics = [f for f in os.listdir(profile_pics_folder) if f.endswith(('.png', '.jpg', '.jpeg'))]
        if selected_pic in profile_pics:
            user.profile_pic = selected_pic
    if password1:
        user.password = generate_password_hash(password1, method='pbkdf2:sha256')

    db.session.commit()
    return jsonify({"message": "Your changes have been saved!"})
# settings update logic end


# Create new project start
@views.route('/create-project', methods=['POST'])
@login_required
def create_project():
    
    data = request.get_json()
    project_name = data.get('projectName')
    description = data.get('description')
    invited_users = data.get('inviteUsers')
    invited_emails = data.get('inviteEmail')

    if not project_name or not description:
        return jsonify({"error": "Project name and description are required."}), 400

    new_project = Project(
        name=project_name,
        description=description,
        project_activity_status=True,
        creator_id=current_user.user_id
    )

    db.session.add(new_project)
    db.session.commit()

    creator_relation = User_Project(
        user_id=current_user.user_id,
        project_id=new_project.project_id,
        role='owner'
    )

    db.session.add(creator_relation)

    # Handle invited user emails
    if invited_emails:
        email_list = [email.strip() for email in invited_emails.replace("\n", ",").split(",") if email.strip()]
        for email in email_list:
            invited_user = User_profile.query.filter_by(email=email).first()
            new_invite = Invitation(
                invited_email=email,
                invited_user_id=invited_user.user_id if invited_user else None,
                referrer_id=current_user.user_id,
                project_id=new_project.project_id
            )
            db.session.add(new_invite)

    db.session.commit()

    return jsonify({"message": "Project created successfully!"})

# Home start
@views.route('/api/mainpage', methods=['GET', 'POST'])
@login_required
def home():
    user = User_profile.query.get(current_user.user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Build project list with same shape as get_user_projects stored procedure (ORM-based fallback)
    user_projects = User_Project.query.filter_by(user_id=user.user_id, is_removed=False).all()
    roles_list = []

    for up in user_projects:
        project = Project.query.get(up.project_id)
        if not project:
            continue
        creator = User_profile.query.get(project.creator_id) if project.creator_id else None

        # Latest version per file in this project (for has_latest and last_modified)
        latest_per_file = (
            db.session.query(File_version)
            .join(File_data, File_version.file_data_id == File_data.file_data_id)
            .filter(File_data.project_id == project.project_id, File_version.last_version == True)
            .all()
        )

        # has_latest: no file has a newer version the user hasn't downloaded (and not uploaded by user)
        has_latest = True
        last_modified_date = project.created_date
        last_modified_by = "Unknown"

        for fv in latest_per_file:
            if fv.upload_date and (last_modified_date is None or fv.upload_date > last_modified_date):
                last_modified_date = fv.upload_date
                uploader = User_profile.query.get(fv.user_id)
                last_modified_by = uploader.full_name if uploader else "Unknown"
            if fv.user_id == user.user_id:
                continue
            ld = Last_download.query.filter_by(
                user_id=user.user_id,
                file_data_id=fv.file_data_id,
                version_id=fv.version_id,
            ).first()
            if not ld:
                has_latest = False

        created_dt = project.created_date
        last_modified_dt = last_modified_date or created_dt

        roles_list.append({
            "project_id": project.project_id,
            "project_name": project.name or "",
            "role": up.role.value if hasattr(up.role, "value") else up.role,
            "created_date": created_dt.isoformat() if created_dt else None,
            "creator_name": creator.full_name if creator else "Unknown",
            "creator_profile_picture": creator.profile_pic if creator and creator.profile_pic else "default.png",
            "has_latest": has_latest,
            "description": project.description or "",
            "last_modified_by": last_modified_by,
            "last_modified_date": last_modified_dt.isoformat() if last_modified_dt else None,
            "nickname": creator.nickname if creator else None,
            "nickname_id": creator.nickname_id if creator else None,
        })

    # Sort: has_latest ASC (False first), then last_modified_date DESC (stable sort)
    roles_list.sort(key=lambda r: (r["last_modified_date"] or ""), reverse=True)
    roles_list.sort(key=lambda r: (0 if r["has_latest"] else 1))

    response_data = {
        "user": {
            "id": user.user_id,
            "name": user.full_name,
            "email": user.email,
            "nickname": user.nickname,
            "nickname_id": user.nickname_id,
            "profile_pic": f"/static/profile_pics/{user.profile_pic}" if user.profile_pic else "/static/profile_pics/default.png"
        },
        "roles": roles_list
    }

    return jsonify(response_data)
# Home end

# Profile data for navbar start
@views.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    user = User_profile.query.get(current_user.user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    profile_data = {
        "name": user.full_name,
        "avatar": f"/static/profile_pics/{user.profile_pic}" if user.profile_pic else "/static/profile_pics/default.png",
        "nickname_id": user.nickname_id,
        "nickname": user.nickname,
    }

    return jsonify(profile_data)
# Profile data for navbar end
