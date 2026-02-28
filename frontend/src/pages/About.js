import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoader } from '../components/LoaderContext';
import styles from '../styles/About.module.css';

const GITHUB_REPO_URL = "https://github.com/yourusername/sortify"; // Change to your actual repo

const About = () => {
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [showAnimatedButton, setShowAnimatedButton] = useState(false);
  const navigate = useNavigate();
  const { hideLoader } = useLoader();

  useEffect(() => {
    const versionTimer = setTimeout(() => setCheckingVersion(false), 4000);
    const buttonTimer = setTimeout(() => setShowAnimatedButton(true), 5000);
    return () => {
      clearTimeout(versionTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  useEffect(() => {
    if (!checkingVersion) return;
    const interval = setInterval(() => {
      // Animate dots for version checking
    }, 400);
    return () => clearInterval(interval);
  }, [checkingVersion]);

  useEffect(() => {
    hideLoader();
  }, [hideLoader]);

  return (
    <div className={styles.aboutContainer}>
      <div className={styles.logoSection}>
        <img
          src="/sortify_logo.png"
          alt="Sortify Logo"
          className={styles.logoImage}
        />
        <h1 className={styles.aboutTitle}>About Sortify</h1>
      </div>
      <div className={styles.demoVersionLine}>
        <b>Demo Version:</b> v0.9.2-beta
      </div>
      <div className={styles.versionChecker}>
        {checkingVersion ? (
          <>
            <span className={`${styles.versionLoading} ${styles.animatedText}`}>
              Checking for updates
            </span>
            <div className={styles.dotLoader}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          </>
        ) : (
          <span>
            This site may have updates. Please check:&nbsp;
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.githubLink} ${styles.animatedLink}`}
            >
              Sortify GitHub Repository
            </a>
          </span>
        )}
      </div>
      <p className={styles.aboutParagraph}>
        <b>Sortify</b> is a modern project management platform designed to help teams collaborate, organize, and succeed.
        Our mission is to make project tracking and teamwork simple, efficient, and enjoyable for everyone.
      </p>
      <div className={styles.aboutParagraph}>
        <b>Features:</b>
        <ul>
          <li>Easy project creation and management</li>
          <li>Team invitations and collaboration</li>
          <li>Modern, user-friendly interface</li>
        </ul>
      </div>
      <hr className={styles.aboutDivider} />
      <div className={styles.aboutFooter}>
        <div>Created: February 2025</div>
        <div>Creators: Akos Mosolygo, Denes Horvath</div>
        <div>&copy; 2025 Sortify. All rights reserved.</div>
      </div>
      <div style={{ marginTop: '64px' }}>
        <button
          className={showAnimatedButton ? styles.coolAnimatedButton : styles.staticButton}
          onClick={() => navigate('/MainPage')}
          type="button"
        >
          Back to the site
        </button>
      </div>
    </div>
  );
};

export default About;