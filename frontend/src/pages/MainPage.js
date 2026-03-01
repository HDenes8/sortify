import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/MainPage.module.css'; // Import styles as an object
import FormattedDate from '../components/FormattedDate'; // adjust if needed
import { useLoader } from '../components/LoaderContext';


const MainPage = ({ defaultRoleFilter = '', showFilterDropdown = true }) => {
  const { hideLoader } = useLoader();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedRole, setSelectedRole] = useState(defaultRoleFilter);
  const [menuOpen, setMenuOpen] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 }); // Added hover position state
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/mainpage', { validateStatus: false });
        if (response.status === 401 || response.status === 302) {
          navigate('/login');
          return;
        }

        setProjects(response.data.roles || []);
        applyFilters(response.data.roles || [], searchQuery, defaultRoleFilter);
      } catch (error) {
        console.error('❌ Error fetching project data:', error);
        navigate('/login');
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [navigate, defaultRoleFilter, hideLoader, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    applyFilters(projects, query, selectedRole);
  };

  const handleRoleFilter = (e) => {
    setSelectedRole(e.target.value);
    applyFilters(projects, searchQuery, e.target.value);
  };

  const applyFilters = (data, query, role) => {
    let filtered = data;

    if (query) {
      filtered = filtered.filter((project) =>
        project.project_name.toLowerCase().includes(query)
      );
    }

    if (role) {
      filtered = filtered.filter((project) => project.role === role);
    }

    setFilteredProjects(filtered);
  };

  const toggleMenu = (projectId, event) => {
    const buttonRect = event.target.getBoundingClientRect(); // Get button position
    setMenuOpen(menuOpen === projectId ? null : projectId);
    setHoverPosition({ x: buttonRect.left - 120, y: buttonRect.top }); // Position menu on the left
  };

  const openProject = (projectId) => {
    navigate(`/ProjectsPage/${projectId}`);
  };

  return (
    <div className={styles['main-page-container']}>
      <div className={styles['search-filter-container']}>
        <input
          type="text"
          className={styles['search-bar']}
          placeholder="Search projects..."
          value={searchQuery}
          onChange={handleSearch}
        />

        {showFilterDropdown && (
          <select
            className={styles['filter-dropdown']}
            value={selectedRole}
            onChange={handleRoleFilter}
          >
            <option value="">all roles</option>
            {[...new Set(projects.map((project) => project.role))].map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        )}
      </div>

      <section className={styles['project-list']}>
        {filteredProjects.length === 0 ? (
          <p className={styles['no-projects-row']}>No projects found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>My Roles</th>
                <th className="date-header">Last Modified</th>
                <th className="date-header">Date</th>
                <th>Owner</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.project_id}>
                  <td data-label="Project Name" className={styles['project-name-cell']}>
                    <div className={styles['project-name-cell-inner']}>
                      <span>{project.project_name}</span>
                      <span
                        className={`${styles['status']} ${
                          project.has_latest === true ? styles['success'] : styles['error']
                        }`}
                      >
                        {project.has_latest === true ? '✔' : '❕'}
                      </span>
                    </div>
                  </td>
                  <td data-label="My Roles">{project.role}</td>
                  <td data-label="Last Modified" className="date-cell">
                    {project.last_modified_date ? (
                      <FormattedDate dateInput={project.last_modified_date} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td data-label="Date" className="date-cell">
                    {project.created_date ? (
                      <FormattedDate dateInput={project.created_date} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td data-label="Owner">
                    <img
                      src={`${API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : ''}/static/profile_pics/${
                        project.creator_profile_picture || 'default.png'
                      }`}
                      alt={`${project.nickname || 'Unknown'}#${project.nickname_id || 'No ID'}`} 
                      className={styles['owner-avatar']}
                    />
                    <span className={styles['ownername']}>
                      {project.nickname || 'Unknown'}
                      <span className="nickname-id">{`#${project.nickname_id || 'No ID'}`}</span>
                    </span>
                  </td>
                  <td data-label="Actions" className="actions-cell">
                    <button
                      className="dots-button"
                      onClick={(e) => toggleMenu(project.project_id, e)}
                    >
                      ⋯
                    </button>
                    {menuOpen === project.project_id && (
                      <div
                        className="horizontal-menu"
                        ref={menuRef}
                        style={{ top: `${hoverPosition.y}px`, left: `${hoverPosition.x}px` }}
                      >
                        <div className="description-box">
                          <span className="description-paragraph">
                            {project.description && <strong>Description:</strong>} {project.description || 'No description available'}
                          </span>
                        </div>
                        <div className="button-container">
                          <button onClick={() => openProject(project.project_id)}>Open Project</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default MainPage;