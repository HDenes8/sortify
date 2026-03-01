import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useLoader } from '../components/LoaderContext';
import styles from '../styles/SignUp.module.css'; // Updated to scoped styles
import { RECAPTCHA_SITE_KEY } from '../config';

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    nickname: '',
    email: '',
    mobile: '',
    job: '',
    password1: '',
    password2: '',
    captchaResponse: '',
  });

  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { hideLoader } = useLoader();

  const loadRecaptchaScript = () => {
    return new Promise((resolve, reject) => {
      if (!document.getElementById('recaptcha-script')) {
        const script = document.createElement('script');
        script.id = 'recaptcha-script';
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        script.async = true;
        script.defer = true;

        const timeout = setTimeout(() => {
          reject(new Error('Captcha script load timeout'));
        }, 10000); // 10-second timeout

        script.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load captcha script'));
        };

        document.body.appendChild(script);
      } else {
        resolve();
      }
    });
  };

  const renderRecaptcha = useCallback(() => {
    if (window.grecaptcha) {
      window.grecaptcha.render('recaptcha-container', {
        sitekey: RECAPTCHA_SITE_KEY || '6LeKEvEqAAAAAI1MIfoiTYc_MBpk6GZ0hXO-fCot',
        callback: handleCaptchaChange,
      });
    }
  }, []);

  const handleCaptchaChange = (response) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      captchaResponse: response,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.captchaResponse) {
      setMessage('Please complete the reCAPTCHA.');
      return;
    }

    try {
      const response = await axios.post('/signup', formData);
      setMessage(response.data.message);

      if (response.data.status === 'success') {
        setTimeout(() => {
          navigate('/login'); // Navigate to the login page after 1 second
        }, 1000);
      }
    } catch (error) {
      if (error.response) {
        setMessage(error.response.data.message);
      } else {
        setMessage('An error occurred. Please try again.');
      }
    } finally {
      if (window.grecaptcha) {
        window.grecaptcha.reset();
      }
      setFormData({ ...formData, captchaResponse: '' });
    }
  };

  useEffect(() => {
    loadRecaptchaScript()
      .then(() => {
        renderRecaptcha();
      })
      .catch((error) => {
        console.error('Failed to load reCAPTCHA script:', error);
      })
      .finally(() => {
        hideLoader();
      });
  }, [renderRecaptcha, hideLoader]);

  return (
    <div className={styles['container']}>
      {message && (
        <div className="global-message-popup">
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} method="POST">
        <div className={styles['logo']} style={{ textAlign: 'center' }}>
          <img src="/sortify_logo.png" alt="Sortify Logo" width="250" />
        </div>
        <h3 align="center">Register</h3>

        <div className={styles['form-group']}>
          <label htmlFor="fullName">Full Name *</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter full name"
            required
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="nickname">Nickname *</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter nickname"
            required
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="email">Email Address *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter email"
            required
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="mobile">Phone Number</label>
          <input
            type="text"
            id="mobile"
            name="mobile"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter mobile number (Optional)"
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="job">Job Title</label>
          <input
            type="text"
            id="job"
            name="job"
            value={formData.job}
            onChange={(e) => setFormData({ ...formData, job: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter job (Optional)"
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="password1">Password *</label>
          <input
            type="password"
            id="password1"
            name="password1"
            value={formData.password1}
            onChange={(e) => setFormData({ ...formData, password1: e.target.value })}
            className={styles['form-control']}
            placeholder="Enter password"
            required
          />
        </div>

        <div className={styles['form-group']}>
          <label htmlFor="password2">Password (Confirm) *</label>
          <input
            type="password"
            id="password2"
            name="password2"
            value={formData.password2}
            onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
            className={styles['form-control']}
            placeholder="Confirm password"
            required
          />
        </div>

        <div id="recaptcha-container" className="g-recaptcha"></div>

        <button type="submit" className={styles['btn-primary']}>
          Submit
        </button>
        <br />
        <span className={styles['privacypolicy']}>
          By clicking Submit, you agree to our Terms of Service and Privacy Policy
        </span>
        <div className={styles['already-account']}>
          <Link to="/login">Already have an account?</Link>
        </div>
      </form>
    </div>
  );
};

export default SignUp;