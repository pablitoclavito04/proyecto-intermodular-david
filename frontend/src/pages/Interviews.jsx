import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { interviewService } from '../api';
import { FiPlus, FiSearch, FiTrash2, FiEye } from 'react-icons/fi';
import { useThemeStore } from '../store';
import '../assets/styles/Interviews.css';

const Interviews = () => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    profession: '',
    type: 'ai_generated',
    difficulty: 'mid',
    language: 'en'
  });

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await interviewService.getInterviews();
      setInterviews(response.data.interviews);
    } catch (error) {
      toast.error(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.profession.trim()) {
      toast.warning('Please fill in all required fields');
      return;
    }
    
    setFormLoading(true);
    
    try {
      let questions = [];
      
      if (formData.type === 'ai_generated') {
        toast.info('Generating questions with AI...');
        
        // ✅ LLAMAR AL BACKEND
        const questionsResponse = await interviewService.generateQuestions({
          profession: formData.profession,
          difficulty: formData.difficulty,
          language: formData.language,
          count: 5
        });
        
        questions = questionsResponse.data.questions;
        
        if (!questions || questions.length === 0) {
          toast.error('Failed to generate questions. Please try again.');
          setFormLoading(false);
          return;
        }
        
        toast.success(`${questions.length} questions generated!`);
      }

      const response = await interviewService.createInterview({
        title: formData.title,
        profession: formData.profession,
        type: formData.type,
        difficulty: formData.difficulty,
        language: formData.language,
        questions: questions
      });

      toast.success('Interview created successfully!');
      setInterviews([response.data.interview, ...interviews]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        profession: '',
        type: 'ai_generated',
        difficulty: 'mid',
        language: 'en'
      });

      setTimeout(() => {
        navigate(`/interview/${response.data.interview.id || response.data.interview._id}`);
      }, 500);
    } catch (error) {
      console.error('Error creating interview:', error);
      const errorMessage = error.response?.data?.message || 'Error creating interview';
      toast.error(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteInterview = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await interviewService.deleteInterview(id);
        setInterviews(interviews.filter(i => i._id !== id));
        toast.success('Interview deleted');
      } catch (error) {
        toast.error(t('errors.serverError'));
      }
    }
  };

  const filteredInterviews = interviews.filter(i =>
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.profession.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`interviews ${isDark ? 'interviews--dark' : ''}`}>
      <div className="interviews__container">
        <div className="interviews__header">
          <h1 className={`interviews__title ${isDark ? 'interviews__title--dark' : ''}`}>
            {t('interview.myInterviews')}
          </h1>
          <div className="interviews__actions">
            <button
              onClick={() => navigate('/dashboard')}
              className="interviews__button interviews__button--dashboard"
            >
              ← {t('dashboard.title')}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={showCreateForm}
              className="interviews__button interviews__button--new"
            >
              <FiPlus /> {t('interview.newInterview')}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className={`interviews__form ${isDark ? 'interviews__form--dark' : ''}`}>
            <h2 className={`interviews__form-title ${isDark ? 'interviews__form-title--dark' : ''}`}>
              {t('interview.newInterview')}
            </h2>
            <form onSubmit={handleCreateInterview} className="interviews__form-grid">
              <input
                type="text"
                placeholder={t('interview.interviewTitle')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={`interviews__form-input ${isDark ? 'interviews__form-input--dark' : ''}`}
                required
                disabled={formLoading}
              />
              <input
                type="text"
                placeholder={t('interview.profession')}
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                className={`interviews__form-input ${isDark ? 'interviews__form-input--dark' : ''}`}
                required
                disabled={formLoading}
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className={`interviews__form-input ${isDark ? 'interviews__form-input--dark' : ''}`}
                disabled={formLoading}
              >
                <option value="ai_generated">{t('interview.aiGenerated')}</option>
                <option value="custom">{t('interview.custom')}</option>
              </select>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className={`interviews__form-input ${isDark ? 'interviews__form-input--dark' : ''}`}
                disabled={formLoading}
              >
                <option value="junior">{t('interview.junior')}</option>
                <option value="mid">{t('interview.mid')}</option>
                <option value="senior">{t('interview.senior')}</option>
              </select>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className={`interviews__form-input ${isDark ? 'interviews__form-input--dark' : ''}`}
                disabled={formLoading}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
              <div className="interviews__form-actions">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="interviews__form-button interviews__form-button--submit"
                >
                  {formLoading ? (
                    <>
                      <div className="interviews__form-spinner"></div>
                      {t('interview.creating')}
                    </>
                  ) : (
                    t('interview.createInterview')
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={formLoading}
                  className="interviews__form-button interviews__form-button--cancel"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="interviews__search">
          <div className="interviews__search-wrapper">
            <FiSearch className="interviews__search-icon" />
            <input
              type="text"
              placeholder={t('interview.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`interviews__search-input ${isDark ? 'interviews__search-input--dark' : ''}`}
            />
          </div>
        </div>

        {loading ? (
          <div className="interviews__loading">
            <div className="interviews__loading-spinner"></div>
          </div>
        ) : filteredInterviews.length === 0 ? (
          <div className={`interviews__empty ${isDark ? 'interviews__empty--dark' : ''}`}>
            <p>{t('interview.noInterviews')}</p>
          </div>
        ) : (
          <div className="interviews__grid">
            {filteredInterviews.map(interview => (
              <div
                key={interview._id}
                className={`interview-card ${isDark ? 'interview-card--dark' : ''}`}
              >
                <div className="interview-card__header">
                  <h3 className={`interview-card__title ${isDark ? 'interview-card__title--dark' : ''}`}>
                    {interview.title}
                  </h3>
                  <span className={`interview-card__status interview-card__status--${interview.status === 'completed' ? 'completed' : interview.status === 'in_progress' ? 'in-progress' : 'scheduled'}`}>
                    {t(`interview.${interview.status === 'completed' ? 'completed' : interview.status === 'in_progress' ? 'inProgress' : 'scheduled'}`)}
                  </span>
                </div>
                <div className="interview-card__info">
                  <div className={`interview-card__info-item ${isDark ? 'interview-card__info-item--dark' : ''}`}>
                    <span className="interview-card__info-label">{t('interview.profession')}:</span>
                    <span>{interview.profession}</span>
                  </div>
                  <div className={`interview-card__info-item ${isDark ? 'interview-card__info-item--dark' : ''}`}>
                    <span className="interview-card__info-label">{t('interview.difficulty')}:</span>
                    <span>{interview.difficulty}</span>
                  </div>
                  <div className={`interview-card__info-item ${isDark ? 'interview-card__info-item--dark' : ''}`}>
                    <span className="interview-card__info-label">{t('interview.score')}:</span>
                    <span>{interview.totalScore}%</span>
                  </div>
                </div>
                <div className="interview-card__actions">
                  <button
                    onClick={() => navigate(`/interview/${interview._id}`)}
                    className="interview-card__button interview-card__button--view"
                  >
                    <FiEye /> {t('interview.view')}
                  </button>
                  <button
                    onClick={() => handleDeleteInterview(interview._id)}
                    className="interview-card__button interview-card__button--delete"
                  >
                    <FiTrash2 /> {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Interviews;
