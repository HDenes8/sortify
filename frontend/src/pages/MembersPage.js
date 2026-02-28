import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import styles from "../styles/MembersPage.module.css"; // Updated to scoped styles
import FormattedDate from "../components/FormattedDate"; // Add this line
import { useLoader } from '../components/LoaderContext';

const MembersPage = () => {
  const navigate = useNavigate();
  const { project_id } = useParams();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [globalMessage, setGlobalMessage] = useState('');
  const { hideLoader } = useLoader();

  // Helper to show global message
  const showGlobalMessage = (msg, timeout = 2000) => {
    setGlobalMessage(msg);
    setTimeout(() => setGlobalMessage(''), timeout);
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`/api/projects/${project_id}/members`, {
        withCredentials: true,
      });

      const roleOrder = { owner: 1, admin: 2, editor: 3, reader: 4 }; // Define the custom order
      const sortedMembers = response.data.members.sort((a, b) => {
        // First, sort by role order
        const roleComparison = roleOrder[a.role] - roleOrder[b.role];
        if (roleComparison !== 0) {
          return roleComparison;
        }
        // If roles are the same, sort alphabetically by name
        return a.name.localeCompare(b.name);
      });

      setMembers(sortedMembers);
      setUserRole(response.data.current_user_role);
      setCurrentUser(response.data.current_user || null);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        navigate("/mainpage");
      } else {
        console.error("Error fetching members:", err);
        setError("Failed to load members.");
      }
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [project_id]);
, hideLoader
  const handleInviteMember = async () => {
    const emailInput = prompt("Enter the email(s) to invite (comma-separated):");
    if (!emailInput) {
      showGlobalMessage("Email is required.");
      return;
    }

    const emailList = emailInput.split(",").map(email => email.trim()).filter(email => email);

    if (emailList.length === 0) {
      showGlobalMessage("No valid emails entered.");
      return;
    }

    let errors = [];

    for (let email of emailList) {
      try {
        const response = await axios.post(
          `/api/projects/${project_id}/invite`,
          { email },
          { withCredentials: true }
        );
        showGlobalMessage(`Invited ${email}: ${response.data.message}`);
      } catch (err) {
        console.error(`Error inviting ${email}:`, err);
        errors.push(`${email}: ${err.response?.data?.error || "Failed to invite."}`);
      }
    }

    if (errors.length > 0) {
      showGlobalMessage("Some errors occurred:\n" + errors.join("\n"));
    }

    fetchMembers();
  };

  const handleRemoveMember = async (userId) => {
    const isSelf = userId === currentUser?.id;
    const confirmationMessage = isSelf
      ? "Are you sure you want to leave this project?"
      : "Are you sure you want to remove this member?";

    setGlobalMessage(
      <span>
        {confirmationMessage}
        <br />
        <button
          className="popup-action-btn"
          onClick={async () => {
            setGlobalMessage('');
            try {
              const response = await axios.post(
                `/api/projects/${project_id}/remove-user`,
                { user_id: userId },
                { withCredentials: true }
              );
              showGlobalMessage(response.data.message);
              if (isSelf) {
                navigate("/mainpage");
              } else {
                fetchMembers();
              }
            } catch (err) {
              console.error("Error removing member:", err);
              showGlobalMessage(err.response?.data?.error || "Failed to remove member.");
            }
          }}
        >
          Yes
        </button>
        <button
          className="popup-action-btn"
          onClick={() => setGlobalMessage('')}
        >
          No
        </button>
      </span>
    );
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!newRole) {
      showGlobalMessage("Role is required.");
      return;
    }

    try {
      const response = await axios.post(
        `/api/projects/${project_id}/change-role`,
        { user_id: userId, role: newRole },
        { withCredentials: true }
      );
      showGlobalMessage(response.data.message);
      fetchMembers();
    } catch (err) {
      console.error("Error changing role:", err);
      showGlobalMessage(err.response?.data?.error || "Failed to change role.");
    }
  };

  const handleBack = () => {
    navigate(`/ProjectsPage/${project_id}`);
  };

  const handleOpenInviteModal = () => {
    setShowInviteModal(true);
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmails("");
  };

  const handleSendInvites = async () => {
    const emailList = inviteEmails.split(",").map(email => email.trim()).filter(email => email);

    if (emailList.length === 0) {
      showGlobalMessage("No valid emails entered.");
      return;
    }

    let errors = [];

    for (let email of emailList) {
      try {
        const response = await axios.post(
          `/api/projects/${project_id}/invite`,
          { email },
          { withCredentials: true }
        );
        showGlobalMessage(`Invited ${email}: ${response.data.message}`);
      } catch (err) {
        console.error(`Error inviting ${email}:`, err);
        errors.push(`${email}: ${err.response?.data?.error || "Failed to invite."}`);
      }
    }

    if (errors.length > 0) {
      showGlobalMessage("Some errors occurred:\n" + errors.join("\n"));
    }

    fetchMembers();
    handleCloseInviteModal();
  };

  if (error) return <p className={styles["error-message"]}>{error}</p>;

  return (
    <div className={styles["members-page-container"]}>
      {globalMessage && (
        <div className="global-message-popup">{globalMessage}</div>
      )}
      <div className={styles["top-buttons"]}>
        <button onClick={handleBack}>Back</button>
        {(userRole === "owner" || userRole === "admin") && (
          <button onClick={handleOpenInviteModal}>Invite Member</button>
        )}
      </div>

      {showInviteModal && (
        <div className={styles["modal"]}>
          <div className={styles["modal-content"]}>
            <h2>Invite Members</h2>
            <textarea
              placeholder="Enter email(s) separated by commas"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              className={styles["email-input"]}
            />
            <div className={styles["modal-buttons"]}>
              <button onClick={handleSendInvites}>Send</button>
              <button onClick={handleCloseInviteModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <h1>Members</h1>

      <table className={styles["members-table"]}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Nickname</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Job</th>
            <th>Role</th>
            <th className="date-header">Join Date</th>
            <th className="actions-header">Action</th>
          </tr>
        </thead>
        <tbody>
          {members.length > 0 ? (
            members.map((member) => {
              const isSelf = member.id === currentUser?.id;
              const isOwner = member.role === "owner";
              const isAdmin = member.role === "admin";

              const canChangeRole =
                !isSelf &&
                ((userRole === "owner") ||
                  (userRole === "admin" && !isOwner && !isAdmin));

              const canRemove =
                !isSelf &&
                ((userRole === "owner" && !isOwner) ||
                  (userRole === "admin" && !isAdmin && !isOwner));

              return (
                <tr key={member.id}>
                  <td data-label="Name">{member.name}</td>
                  <td data-label="Nickname">
                    <span>
                      {member.nickname || 'Unknown'}
                      <span className="nickname-id">{`#${member.nickname_id || 'No ID'}`}</span>
                    </span>
                  </td>
                  <td data-label="Email">{member.email}</td>
                  <td data-label="Mobile">{member.phoneNumber}</td>
                  <td data-label="Job">{member.job}</td>
                  <td data-label="Role">
                    <select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member.id, e.target.value)}
                      disabled={!canChangeRole || isOwner}
                    >
                      <option value="owner" disabled>
                        Owner
                      </option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="reader">Reader</option>
                    </select>
                  </td>
                  <td data-label="Join Date" className="date-cell">
                    {member.join_date ? <FormattedDate dateInput={member.join_date} /> : '-'}
                  </td>
                  <td data-label="Action" className="actions-cell">
                    <div className={styles["remove-buttons"]}>
                      {!isOwner && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={isSelf && userRole === "owner"}
                        >
                          {isSelf ? "Leave" : "Remove"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No members found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MembersPage;
