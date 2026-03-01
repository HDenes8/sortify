from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from .models import User_profile, User_Project, Project
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
import phonenumbers
import re
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from flask_wtf.recaptcha import RecaptchaField
import os
import requests
import random
import bleach


from flask_cors import cross_origin

auth = Blueprint('auth', __name__)

#login start
@auth.route('/login', methods=['GET', 'POST'])
@cross_origin(origins=["https://sortify-eight.vercel.app"], supports_credentials=True)
def login():
    data = request.get_json()  
    email = data.get('email')
    password = data.get('password')

    user = User_profile.query.filter_by(email=email).first()
    if user:
        if check_password_hash(user.password, password):
            login_user(user, remember=True)
            return {"message": "Logged in successfully!", "status": "success"}, 200
        else:
            return {"message": "Incorrect password, try again.", "status": "error"}, 401
    else:
        return {"message": "Email does not exist.", "status": "error"}, 404
# login end


# logout start
@auth.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200
# logout end


# sign-up start
# reCAPTCHA keys are loaded from environment so they can be changed per deployment
# (e.g. development vs. production).  set these in Render or via dotenv.
# Example:
#   RECAPTCHA_PUBLIC_KEY=6LeKEvEqAAAAAI1MIfoiTYc_MBpk6GZ0hXO-fCot
#   RECAPTCHA_PRIVATE_KEY=6LeKEvEqAAAAACB2kZN3_QckJOu_nYtxpHuRWz2O

# Verify reCAPTCHA function

def verify_recaptcha(response):
    secret_key = os.getenv('RECAPTCHA_PRIVATE_KEY')
    print("reCAPTCHA secret used:", secret_key)  # debug
    if not secret_key:
        # fallback for local testing (not recommended long term)
        secret_key = "6LeKEvEqAAAAACB2kZN3_QckJOu_nYtxpHuRWz2O"
    verify_url = "https://www.google.com/recaptcha/api/siteverify"
    payload = {'secret': secret_key, 'response': response}
    result = requests.post(verify_url, data=payload).json()
    print("reCAPTCHA API response:", result)  # Debugging
    return result.get("success", False)

# Regex patterns
FULL_NAME_REGEX = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ-]+(?: [A-Za-zÀ-ÖØ-öø-ÿ-]+)*$")
NICKNAME_REGEX = re.compile(r"^[A-Za-z0-9_]+$")
JOB_REGEX = re.compile(r"^[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű\s-]+$")
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[{}\[\]\-_$@!%*?&#^()+=~`|\\:;\"'<>,./])[A-Za-z\d{}\[\]\-_$@!%*?&#^()+=~`|\\:;\"'<>,./]{7,}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

# phone number validation
def is_valid_phone_number(number):  
    try:
        parsed_number = phonenumbers.parse(number)
        return phonenumbers.is_valid_number(parsed_number)
    except phonenumbers.NumberParseException:
        return False

@auth.route('/signup', methods=['POST'])
@cross_origin(origins=["https://sortify-eight.vercel.app"], supports_credentials=True)
def sign_up():
    if request.method == 'POST':
        data = request.get_json() 
        captcha_response = data.get('captchaResponse')

        # Verify reCAPTCHA
        if not verify_recaptcha(captcha_response):
            return {"message": "Please complete the CAPTCHA.", "status": "error"}, 400

        # Get data from the request, bleach and validate
        email = data.get('email')
        full_name = bleach.clean(data.get('fullName', ""), strip=True)
        nickname = bleach.clean(data.get('nickname', ""), strip=True)
        password1 = data.get('password1')
        password2 = data.get('password2')

        # Optional fields
        mobile = data.get('mobile') or None
        job = bleach.clean(data.get('job', ""), strip=True) if data.get('job') else None

        # Check for existing user and validate inputs
        user = User_profile.query.filter_by(email=email).first()
        if user:
            return {"message": "Email already exists.", "status": "error"}, 400
        elif len(email) < 4:
            return {"message": "Email must be greater than 3 characters.", "status": "error"}, 400
        elif not EMAIL_REGEX.match(email):
            return {"message": "Invalid email format.", "status": "error"}, 400
        elif len(full_name) < 2:
            return {"message": "Full name must be greater than 1 character.", "status": "error"}, 400
        elif not FULL_NAME_REGEX.match(full_name):
            return {"message": "Full name must only contain letters, spaces, and hyphens.", "status": "error"}, 400
        elif len(nickname) < 2:
            return {"message": "Nickname must be greater than 1 character.", "status": "error"}, 400
        elif len(nickname) > 10: 
            return {"message": "Nickname must not exceed 20 characters.", "status": "error"}, 400
        elif not NICKNAME_REGEX.match(nickname):
            return {"message": "Nickname can only contain letters, numbers, and underscores.", "status": "error"}, 400
        elif job and not JOB_REGEX.match(job):
            return {"message": "Job can only contain letters, numbers, and underscores.", "status": "error"}, 400
        elif mobile and not is_valid_phone_number(mobile):
            return {"message": "Invalid phone number.", "status": "error"}, 400
        elif password1 != password2:
            return {"message": "Passwords don't match.", "status": "error"}, 400
        elif not PASSWORD_REGEX.match(password1):
            return {
                "message": "Password must be at least 7 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
                "status": "error",
            }, 400
        
        # Generate nickname_id 
        possible_ids = list(range(1, 10000))
        taken_ids = [
            user.nickname_id for user in User_profile.query.filter_by(nickname=nickname).all()
        ]            
        available_ids = list(set(possible_ids) - set(taken_ids))

        if not available_ids:
            return {"message": "No available nickname IDs for this nickname.", "status": "error"}, 500
        else:
            nickname_id = random.choice(available_ids)

        # Check if nickname is already taken, and if not, generate a new user
        if nickname_id:
            new_user = User_profile(
                email=email,
                full_name=full_name,
                password=generate_password_hash(password1, method='pbkdf2:sha256'),
                nickname=nickname,
                mobile=mobile,
                nickname_id=nickname_id, 
                job=job,
            )

            db.session.add(new_user)
            db.session.commit()

            login_user(new_user, remember=True)

            return {"message": "Account created successfully!", "status": "success"}, 201

    # If the request method is not POST, return an error
    return {"message": "Invalid request method.", "status": "error"}, 405

# sign-up end