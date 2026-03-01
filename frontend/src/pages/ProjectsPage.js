import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../styles/ProjectsPage.module.css'; // Import styles as an object
import FormattedDate from '../components/FormattedDate';
import { useLoader } from '../components/LoaderContext';
import { API_BASE_URL } from '../config';


function formatFileSize(sizeInBytes) {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let size = sizeInBytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${Math.ceil(size)} ${units[unitIndex]}`;
}

// Helper to truncate comments to 30 chars
function truncateComment(comment) {
  if (!comment) return null;
  return comment.length > 30 ? comment.slice(0, 30) + '...' : comment;
}

const ProjectsPage = () => {
  const { project_id } = useParams();
  const navigate = useNavigate();
  const { hideLoader } = useLoader();

  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [uploadData, setUploadData] = useState({ file: null, description: '', title: '' });
  const [versionUploadTarget, setVersionUploadTarget] = useState(null);
  const [versionUploadData, setVersionUploadData] = useState({ file: null, comment: '' });
  const [expandedFile, setExpandedFile] = useState(null);
  const [fileVersions, setFileVersions] = useState({});
  const [download_file_results, setDownloadFileResults] = useState({}); // To track download results 
  const [localError, setLocalError] = useState(null);
  const [showDescription, setShowDescription] = useState(false);
  const [hoveredComment, setHoveredComment] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [globalMessage, setGlobalMessage] = useState('');

  // Helper to show global message (define this before any usage)
  const showGlobalMessage = React.useCallback((msg, timeout = 2000) => {
    setGlobalMessage(msg);
    setTimeout(() => setGlobalMessage(''), timeout);
  }, []);

  const dropdownRef = useRef(null); // To track the dropdown menu

  const toggleFileDropdown = (fileId, event) => {
    const buttonRect = event.target.getBoundingClientRect(); // Get button position
    setExpandedFile(expandedFile === fileId ? null : fileId);
    setHoverPosition({ x: buttonRect.left - 120, y: buttonRect.top }); // Position menu on the left
  };

  // toggleFileVersionsDisplay was unused; use toggleVersionTable instead

  const closeFileDropdown = () => {
    setExpandedFile(null);
  };

  const handleCommentHover = (comment, event) => {
    if (comment.length > 20) { // Show bubble only for truncated comments
      setHoveredComment(comment);
      setHoverPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleCommentLeave = () => {
    setHoveredComment(null);
  };

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeFileDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch project data
  // Fetch project data from the server
  const fetchProjectData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/project/${project_id}`);
      if (!response.ok) {
        const errorData = await response.json();
        showGlobalMessage(`Error: ${errorData.error}`);
        return;
      }
      const data = await response.json();
      console.log("Project data:", data); // Debugging

      const sortedFiles = data.files.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
      setProject(data.project);
      setFiles(sortedFiles);
      setDownloadFileResults(data.download_file_results); // Store download_file_results in state
    } catch (error) {
      console.error("Error fetching project data:", error);
      showGlobalMessage("An error occurred while fetching project data.");
    } finally {
      hideLoader();
    }
  };

  const fetchFileVersions = async (fileId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/versions`);
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || `Failed to fetch versions for file ${fileId}`);
        return;
      }
      const data = await response.json();
      setFileVersions((prev) => ({
        ...prev,
        [fileId]: data.version_history,
      }));
    } catch (error) {
      console.error(`Error fetching versions for file ${fileId}:`, error);
      setError("An error occurred while fetching file versions.");
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProjectData();
  }, [project_id]);

  const handleFileChange = (e) => {
    setUploadData({ ...uploadData, file: e.target.files[0] });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUploadData({ ...uploadData, [name]: value });
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("file", uploadData.file);
    formData.append("description", uploadData.description);
    formData.append("title", uploadData.title);

    try {
      const response = await fetch(`/api/projects/${project_id}/upload`, {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();
      const jsonData = JSON.parse(rawText);

      if (response.ok) {
        setShowUploadModal(false);
        showGlobalMessage("File uploaded successfully!");
        fetchProjectData(); // Refresh the file list
      } else {
        showGlobalMessage(`Error: ${jsonData.error || 'Upload failed'}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showGlobalMessage("An error occurred while uploading the file.");
    }
  };

  const handleVersionUploadSubmit = async (e) => {
    e.preventDefault();
    if (!versionUploadTarget) {
      showGlobalMessage("No file selected for version upload.");
      return;
    }
  
    const formData = new FormData();
    formData.append("file", versionUploadData.file);
    formData.append("comment", versionUploadData.comment); // ✅ Use the actual user input
    formData.append("main_file_id", versionUploadTarget.file_data_id); // Link to the main file
  
    try {
      const response = await fetch(`/api/projects/${project_id}/upload`, {
        method: "POST",
        body: formData,
      });
  
      const jsonData = await response.json();
  
      if (response.ok) {
        setVersionUploadTarget(null);
        setVersionUploadData({ file: null, comment: '' });
        showGlobalMessage("Version uploaded!");
        fetchProjectData(); // Refresh file list
      } else {
        showGlobalMessage(`Error: ${jsonData.error}`);
      }
    } catch (err) {
      console.error("Upload version failed:", err);
      showGlobalMessage("Failed to upload version.");
    }
  };  

  const handleDownloadSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      showGlobalMessage("No files selected for download.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_files: selectedFiles }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected_files.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setShowDownloadModal(false);
        showGlobalMessage("Download started.");
      } else {
        const errorData = await response.json();
        showGlobalMessage(`Error: ${errorData.error || 'Failed to download files'}`);
      }
    } catch (error) {
      console.error("Error downloading files:", error);
      showGlobalMessage("An error occurred while downloading the files.");
    }
  };

  const handleFileSelect = (e) => {
    const value = e.target.value;
    setSelectedFiles(prev =>
      e.target.checked ? [...prev, value] : prev.filter(id => id !== value)
    );
  };

  const toggleVersionTable = (fileId) => {
    if (!fileVersions[fileId]) {
      fetchFileVersions(fileId); // Load if not yet loaded
    } else {
      setFileVersions((prev) => {
        const updated = { ...prev };
        delete updated[fileId]; // Toggle hide
        return updated;
      });
    }
  };
  

  // Example filter logic (customize as needed)
  useEffect(() => {
    setFilteredFiles(files); // Replace with filter logic if needed
  }, [files]);

  // Track the widths of each column in the main table
  const mainTableRef = useRef(null);
  const colRefs = useRef([]);
  const [colWidths, setColWidths] = useState([]);

  // After render, measure all column widths in the main table
  useEffect(() => {
    if (mainTableRef.current && colRefs.current.length) {
      const widths = colRefs.current.map(ref =>
        ref && ref.offsetWidth ? ref.offsetWidth : undefined
      );
      setColWidths(widths);
    }
  }, [filteredFiles]);

  if (!project) return <p>Loading...</p>;

  return (
    <div className={styles['project-page-container']}>
      {globalMessage && (
        <div className="global-message-popup">{globalMessage}</div>
      )}
      <div className={styles['top-buttons']}>
        <button
          className={styles['button-secondary']}
          onClick={() => setShowDescription(!showDescription)}
        >
          {showDescription ? "Hide Description" : "Show Description"}
        </button>
        <button
          className={styles['button-primary']}
          onClick={() => setShowUploadModal(true)}
        >
          Upload File
        </button>
        <button
          className={styles['button-primary']}
          onClick={() => setShowDownloadModal(true)}
        >
          Download Files
        </button>
        <button
          className={styles['button-secondary']}
          onClick={() => navigate(`/MembersPage/${project_id}`)}
        >
          Members
        </button>
      </div>

      {showDescription && (
        <div className={styles['description-box']}>
          <p className={styles['description-paragraph']}>
            {project.description || "No description available for this project."}
          </p>
        </div>
      )}

      <h3>Files</h3>
      <section className={styles['file-info']}>
        {filteredFiles.length === 0 ? (
          <p className={styles['no-files-row']}>No files uploaded yet.</p>
        ) : (
          <>
            {/* Main files table */}
            <table ref={mainTableRef}>
              <thead>
                <tr>
                  <th className={styles['select-cell']}>Select</th>
                  <th className={styles['ver-cell']}>Ver</th>
                  <th>Title</th>
                  <th>File Name</th>
                  <th>Comment</th>
                  <th>File Size</th>
                  <th className="date-header">
                    <span style={{ display: "block", textAlign: "center", width: "100%" }}>Upload Date</span>
                  </th>
                  <th>Uploader</th>
                  <th className="actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, idx) => (
                  <React.Fragment key={file.version_id}>
                    <tr>
                      <td data-label="Select" className={styles['checkbox-cell']} ref={el => colRefs.current[0] = el}>
                        <input
                          type="checkbox"
                          value={file.version_id}
                          onChange={handleFileSelect}
                        />
                      </td>
                      <td data-label="Ver" className={styles['ver-cell']} ref={el => colRefs.current[1] = el}>
                        {file.version_number}
                        <span className={`${styles['status']} ${download_file_results[file.version_id] ? styles['success'] : styles['error']}`}>
                          {download_file_results[file.version_id] ? '✔' : '❕'}
                        </span>
                      </td>
                      <td data-label="Title"
                        title={file.title}
                        ref={el => colRefs.current[2] = el}
                        style={{ minWidth: 80, maxWidth: 400 }}
                      >
                        {file.title}
                      </td>
                      <td data-label="File Name"
                        title={file.file_name}
                        className={styles['file-name-cell']}
                        ref={el => colRefs.current[3] = el}
                      >
                        {file.file_name.length > 40
                          ? `${file.file_name.slice(0, 15)}......${file.file_name.slice(-15)}`
                          : file.file_name}
                      </td>
                      <td data-label="Comment"
                        className={styles['comment-cell']}
                        title={file.comment}
                        onMouseEnter={(e) => handleCommentHover(file.comment, e)}
                        onMouseLeave={handleCommentLeave}
                        ref={el => colRefs.current[4] = el}
                      >
                        {file.comment
                          ? truncateComment(file.comment)
                          : <span className={styles['no-comment']}>no comment</span>
                        }
                      </td>
                      <td data-label="File Size" ref={el => colRefs.current[5] = el}>
                        {formatFileSize(file.file_size)}
                      </td>
                      <td data-label="Upload Date" className="date-cell" ref={el => colRefs.current[6] = el}>
                        <FormattedDate dateInput={file.upload_date} />
                      </td>
                      <td data-label="Uploader" ref={el => colRefs.current[7] = el}>
                        {file.uploader_nickname ? (
                          <div className={styles['uploader-info']}>
                            <img
                              src={file.uploader_pic || '/default-profile.png'}
                              alt={`${file.uploader_nickname}'s profile`}
                              className={styles['uploader-profile-picture']}
                            />
                            <span>
                              {file.uploader_nickname || 'Unknown'}
                              <span className="nickname-id">{`#${file.uploader_nickname_id || 'No ID'}`}</span>
                            </span>
                          </div>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                      <td data-label="Actions" className="actions-cell" ref={el => colRefs.current[8] = el}>
                        <button
                          className="dots-button"
                          onClick={(e) => toggleFileDropdown(file.version_id, e)}
                        >
                          ⋯
                        </button>
                        {expandedFile === file.version_id && (
                          <div
                            className="horizontal-menu"
                            ref={dropdownRef}
                            style={{ top: `${hoverPosition.y}px`, left: `${hoverPosition.x}px` }}
                          >
                            <div className="description-box">
                              <span className="description-paragraph">
                                {file.description
                                  ? (<><strong>Description:</strong> {file.description}</>)
                                  : "No description available"}
                              </span>
                            </div>
                            <div className="button-container">
                              <button onClick={() => toggleVersionTable(file.file_data_id)}>
                                {fileVersions[file.file_data_id] ? 'Hide Versions' : 'Show Versions'}
                              </button>
                              <button
                                onClick={() => {
                                  setVersionUploadTarget(file);
                                  closeFileDropdown();
                                }}
                              >
                                Upload New Version
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Version history table for this file */}
                    {fileVersions[file.file_data_id] && (
                      <tr className={styles['version-history-row']}>
                        <td
                          className={styles['version-history-data']}
                          colSpan="9"
                          style={{ padding: 0, borderLeft: 'none' }}
                        >
                          <div style={{ display: 'flex' }}>
                            <div style={{
                              width: '5px',
                              background: '#007bff',
                              borderRadius: '5px 0 0 5px',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <table
                                style={{ width: '100%', tableLayout: "auto", margin: 0, borderSpacing: 0 }}
                              >
                                <colgroup>
                                  {colWidths.map((w, i) => (
                                    <col key={i} style={w ? { width: w } : {}} />
                                  ))}
                                </colgroup>
                                <tbody>
                                  {fileVersions[file.file_data_id]
                                    .filter((version) => version.version_id !== file.version_id)
                                    .map((version) => (
                                      <tr key={version.version_id} className={styles['version-history-row']}>
                                        <td data-label="Select" className={styles['checkbox-cell']}>
                                          <input
                                            type="checkbox"
                                            value={version.version_id}
                                            onChange={handleFileSelect}
                                          />
                                        </td>
                                        <td data-label="Ver" className={styles['ver-cell']}>
                                          {version.version_number}
                                          <span className={`${styles['status']} ${version.downloaded ? styles['success'] : styles['warning']}`}>
                                            {version.downloaded ? "✔" : "❕"}
                                          </span>
                                        </td>
                                        <td data-label="Title"
                                          style={{ minWidth: 80, maxWidth: 400 }}
                                          title={file.title}
                                        >
                                          {/* Hidden but keeps width for alignment */}
                                          <span style={{ visibility: 'hidden' }}>{file.title}</span>
                                        </td>
                                        <td data-label="File Name"
                                          title={version.file_name}
                                          className={styles['file-name-cell']}
                                        >
                                          {version.file_name.length > 40
                                            ? `${version.file_name.slice(0, 15)}......${version.file_name.slice(-15)}`
                                            : version.file_name}
                                        </td>
                                        <td data-label="Comment"
                                          className={styles['comment-cell']}
                                          title={version.comment}
                                        >
                                          {version.comment
                                            ? truncateComment(version.comment)
                                            : <span className={styles['no-comment']}>no comment</span>
                                          }
                                        </td>
                                        <td data-label="File Size">{formatFileSize(version.file_size)}</td>
                                        <td data-label="Upload Date" className="date-cell">
                                          <FormattedDate dateInput={version.upload_date} />
                                        </td>
                                        <td data-label="Uploader">
                                          {version.uploader_nickname ? (
                                            <div className={styles['uploader-info']}>
                                              <img
                                                src={version.uploader_pic || '/default-profile.png'}
                                                alt={`${version.uploader_nickname}'s profile`}
                                                className={styles['uploader-profile-picture']}
                                              />
                                              <span>
                                                {version.uploader_nickname || 'Unknown'}
                                                <span className="nickname-id">{`#${version.uploader_nickname_id || 'No ID'}`}</span>
                                              </span>
                                            </div>
                                          ) : (
                                            "Unknown"
                                          )}
                                        </td>
                                        <td data-label="Actions" className="actions-cell">
                                          <span style={{ visibility: 'hidden' }}>•••</span>
                                        </td>
                                      </tr>
                                    ))}
                                  {fileVersions[file.file_data_id].filter((version) => version.version_id !== file.version_id).length === 0 && (
                                    <tr>
                                      <td colSpan="9" style={{ textAlign: "center" }}>There are no older versions yet.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className={styles['modal-overlay']}>
          <div className={styles['modal']}>
            <h2>Upload File</h2>
            <form onSubmit={handleUploadSubmit} encType="multipart/form-data" className={styles['form-container']}>
              <input type="file" name="file" required onChange={handleFileChange} />
              <input
                type="text"
                name="title"
                placeholder="Title"
                onChange={handleInputChange}
              />
              <input
                type="text"
                name="description"
                placeholder="Description (optional)"
                onChange={handleInputChange}
              />
              <div className={styles['modal-buttons']}>
                <button type="submit" className={styles['button-primary']}>
                  Upload
                </button>
                <button
                  type="button"
                  className={styles['button-secondary']}
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Version Modal */}
      {versionUploadTarget && (
        <div className={styles['modal-overlay']}>
          <div className={styles['modal']}>
            <h2>Upload New Version for "{versionUploadTarget.file_name}"</h2>
            <form onSubmit={handleVersionUploadSubmit} encType="multipart/form-data" className={styles['form-container']}>
              <input type="file" required onChange={(e) =>
                setVersionUploadData({ ...versionUploadData, file: e.target.files[0] })} />
              <input
                type="text"
                placeholder="Comment (optional)"
                onChange={(e) =>
                  setVersionUploadData({ ...versionUploadData, comment: e.target.value })}
              />
              <div className={styles['modal-buttons']}>
                <button type="submit" className={styles['button-primary']}>
                  Upload Version
                </button>
                <button
                  type="button"
                  className={styles['button-secondary']}
                  onClick={() => setVersionUploadTarget(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div className={styles['modal-overlay']}>
          <div className={styles['modal']}>
            <h2>Download Files</h2>
            <p>You have selected {selectedFiles.length} file(s) to download.</p>
            <form onSubmit={handleDownloadSubmit}>
              <div className={styles['modal-buttons']}>
                <button type="submit" className='btn-primary'>
                  Download
                </button>
                <button
                  type="button"
                  className='btn-secondary'
                  onClick={() => setShowDownloadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {hoveredComment && (
        <div
          className={styles['comment-hover-bubble']}
          style={{ top: hoverPosition.y + 10, left: hoverPosition.x + 10 }}
        >
          {hoveredComment}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
