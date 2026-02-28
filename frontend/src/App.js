import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignUp from './pages/SignUp';
import MainPage from './pages/MainPage';
import MyProjectsPage from './pages/MyProjectsPage';
import Invitations from './pages/Invitations';
import CreateProject from './pages/CreateProject';
import Settings from './pages/Settings';
import ProjectsPage from './pages/ProjectsPage';
import MembersPage from './pages/MembersPage';
import About from './pages/About';
import { LoaderProvider, useLoader } from './components/LoaderContext';
import GlobalLoader from './components/GlobalLoader';
import './App.css';

function AppRoutes() {
  const location = useLocation();
  const { loading, showLoader } = useLoader();

  useEffect(() => {
    let minTimer;
    showLoader();
    minTimer = setTimeout(() => {
      // If the page hasn't called hideLoader yet, keep loader visible
      // hideLoader will be called by the page when data is ready
    }, 500); // minimum 0.5s

    return () => clearTimeout(minTimer);
    // hideLoader will be called by the page/component when data is loaded
  }, [location.pathname, showLoader]);

  return (
    <>
      {loading && <GlobalLoader />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/" element={
          <Layout>
            <LoginPage />
          </Layout>
        } />
        <Route path="/MainPage" element={
          <Layout>
            <MainPage />
          </Layout>
        } />
        <Route path="/MyProjectsPage" element={
          <Layout>
            <MyProjectsPage />
          </Layout>
        } />
        <Route path="/invitations" element={
          <Layout>
            <Invitations />
          </Layout>
        } />
        <Route path="/create-project" element={
          <Layout>
            <CreateProject />
          </Layout>
        } />
        <Route path="/settings" element={
          <Layout>
            <Settings />
          </Layout>
        } />
        <Route path="/ProjectsPage/:project_id" element={
          <Layout>
            <ProjectsPage />
          </Layout>
        } />
        <Route path="/MembersPage/:project_id" element={
          <Layout>
            <MembersPage />
          </Layout>
        } />
        <Route path="/about" element={<About />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <LoaderProvider>
      <Router>
        <AppRoutes />
      </Router>
    </LoaderProvider>
  );
}

export default App;
