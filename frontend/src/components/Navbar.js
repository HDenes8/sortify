import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../styles/Navbar.module.css'; // Updated to scoped styles
import {
  FaHome,
  FaFolder,
  FaHeart,
  FaEnvelope,
  FaPlus,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaInfoCircle,
} from 'react-icons/fa';

const Navbar = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [logoutMessage, setLogoutMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch project information if on ProjectsPage or MembersPage
  useEffect(() => {
    const fetchProjectInfo = async () => {
      const path = window.location.pathname;
      if (path.startsWith('/ProjectsPage') || path.startsWith('/MembersPage')) {
        const projectId = path.split('/').pop();
        try {
          const response = await axios.get(`/project/${projectId}`);
          if (response.status === 200) {
            setProjectInfo({
              name: response.data.project.name,
              role: response.data.project.role, // Assuming the API returns the user's role
            });
          }
        } catch (error) {
          console.error('Error fetching project info:', error);
        }
      }
    };

    fetchProjectInfo();
  }, [location.pathname]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileResponse = await axios.get('/api/profile', { validateStatus: false });
        if (profileResponse.status === 401 || profileResponse.status === 302) {
          navigate('/login');
          return;
        }

        // Set the fetched data to state
        setProfile(profileResponse.data || { name: '', avatar: '/static/profile_pics/default.png', nickname: '', nickname_id: '' });
      } catch (error) {
        console.error('Error fetching profile data:', error);
        navigate('/login');
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/logout');
      setLogoutMessage('You successfully logged out');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000); // Changed from 2000 to 1000 ms
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <aside className={`${styles['navbar-sidebar']} ${sidebarCollapsed ? styles['collapsed'] : ''}`}>
        <div className={styles['navbar-sidebar-header']}>
          <h2>Sortify</h2>
          <button
            className={styles['navbar-collapse-button']}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <FaBars />
          </button>
        </div>
        <nav className={styles['navbar-sidebar-nav']}>
          <ul>
            <li
              className={window.location.pathname === '/MainPage' ? styles['active'] : ''}
              onClick={() => navigate('/MainPage')}
            >
              <FaHome /> {!sidebarCollapsed && 'Main Page'}
            </li>
            <li
              className={window.location.pathname === '/MyProjectsPage' ? styles['active'] : ''}
              onClick={() => navigate('/MyProjectsPage')}
            >
              <FaFolder /> {!sidebarCollapsed && 'My Projects'}
            </li>
            <li
              className={window.location.pathname === '/favourite' ? `${styles['active']} ${styles['disabled']}` : styles['disabled']}
            >
              <FaHeart style={{ color: 'grey', cursor: 'not-allowed' }} /> {!sidebarCollapsed && 'Favourite (under maintenance)'}
            </li>
            <li
              className={window.location.pathname === '/invitations' ? styles['active'] : ''}
              onClick={() => navigate('/invitations')}
            >
              <FaEnvelope /> {!sidebarCollapsed && 'Invitation'}
            </li>
            <li
              className={window.location.pathname === '/create-project' ? styles['active'] : ''}
              onClick={() => navigate('/create-project')}
            >
              <FaPlus /> {!sidebarCollapsed && 'Create New Project'}
            </li>
            <li
              className={window.location.pathname === '/settings' ? styles['active'] : ''}
              onClick={() => navigate('/settings')}
            >
              <FaCog /> {!sidebarCollapsed && 'Settings'}
            </li>
            <li
              className={window.location.pathname === '/about' ? styles['active'] : ''}
              onClick={() => navigate('/about')}
              style={{ marginTop: 'auto' }}
            >
              <FaInfoCircle /> {!sidebarCollapsed && 'About'}
            </li>
          </ul>
        </nav>
        <div className={styles['navbar-sidebar-footer']}>
          <p className={styles['licencing']}>© 2025 Sortify</p>
        </div>
      </aside>

      <header className={styles['navbar-header']}>
        {projectInfo &&
        (window.location.pathname.startsWith('/ProjectsPage') ||
          window.location.pathname.startsWith('/MembersPage')) ? (
          <div className={styles['project-info']}>
            <h1 className={styles['project-title']}>{projectInfo.name}</h1>
            <p className={styles['project-role']}>
              <strong>Role:</strong> {projectInfo.role}
            </p>
          </div>
        ) : (
          <h1>{getPageTitle()}</h1>
        )}
        <div className={styles['user-profile']}>
          <img src={profile.avatar} alt="User" />
          <span>
            {profile.nickname || "Loading"}
            <span className="nickname-id">{`#${profile.nickname_id || 'No ID'}`}</span>
          </span>
          <button onClick={handleLogout}>
            <FaSignOutAlt />
          </button>
        </div>
        {logoutMessage && (
          <div className="global-message-popup">
            {logoutMessage}
          </div>
        )}
      </header>
    </>
  );
};

function getPageTitle() {
  const path = window.location.pathname;

  switch (path) {
    case '/MainPage':
      return 'Main Page';
    case '/MyProjectsPage':
      return 'My Projects';
    case '/favourite':
      return 'Favourite';
    case '/invitations':
      return 'Invitations';
    case '/create-project':
      return 'Create New Project';
    case '/settings':
      return 'Settings';
    case '/about':
      return 'About';
    case '/ProjectsPage':
      return 'Projects Page';
    default:
      return 'Sortify';
  }
}

export default Navbar;
