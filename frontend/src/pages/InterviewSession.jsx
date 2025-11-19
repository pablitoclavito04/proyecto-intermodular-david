import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { interviewService, responseService } from '../api';
import { FiArrowLeft, FiArrowRight, FiX, FiCheck } from 'react-icons/fi';
import { useThemeStore } from '../store';
import '../assets/styles/InterviewSession.css';


const MicrophoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="interview-session__mic-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
};

const InterviewSession = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDark } = useThemeStore();

  // Estados del formulario
  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados del reconocimiento de voz
  const [isListening, setIsListening] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [voiceStatus, setVoiceStatus] = useState(''); 
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Referencias
  const recognitionRef = useRef(null);
  const userAnswerRef = useRef('');
  const totalTimeIntervalRef = useRef(null);

  useEffect(() => {
    fetchInterview();
    // eslint-disable-next-line
  }, [interviewId]);

  // Inicializar reconocimiento de voz
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setUserAnswer(prev => {
            const newAnswer = prev + finalTranscript;
            userAnswerRef.current = newAnswer;
            return newAnswer;
          });
        }
        if (interimTranscript) setVoiceStatus(`Escuchando: ${interimTranscript}`);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (userAnswerRef.current.trim()) {
          setIsConfirming(true);
          setVoiceStatus('Revisa tu respuesta y confirma o reintenta.');
        } else {
          setVoiceStatus('Haz clic en el micrófono para intentarlo de nuevo.');
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setVoiceStatus('Error de reconocimiento de voz. Revisa tu micrófono.');
        setIsListening(false);
        toast.error('Error de reconocimiento de voz.');
      };

      totalTimeIntervalRef.current = window.setInterval(() => {
        setTotalTime(prev => prev + 1);
      }, 1000);
    } else {
      setVoiceStatus('El reconocimiento de voz no es compatible con tu navegador.');
      toast.error('Reconocimiento de voz no soportado.');
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (totalTimeIntervalRef.current) clearInterval(totalTimeIntervalRef.current);
    };
  }, []);

  // Temporizador de respuesta
  useEffect(() => {
    let answerTimer;
    if (isListening) {
      answerTimer = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(answerTimer);
  }, [isListening]);

  const fetchInterview = async () => {
    try {
      setLoading(true);
      const response = await interviewService.getInterview(interviewId);
      const interviewData = response.data.interview;
      setInterview(interviewData);

      if (interviewData.status === 'in_progress') {
        const map = {};
        (interviewData.questions || []).forEach((q, idx) => {
          if (q?.responses?.[0]?.responseText)
            map[idx] = q.responses[0].responseText;
        });
        setResponses(map);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error loading interview');
      navigate('/interviews');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = interview && interview.status === 'completed';
  const isInProgress = interview && interview.status === 'in_progress';
  const questions = interview?.questions || [];
  const question = questions[currentQuestion] || {};

  const responseSaved = question?.responses?.[0]?.responseText || '';
  const localResponse = responses[currentQuestion] || '';

  const allAnswered = questions.every((q, idx) => {
    if (isCompleted)
      return q?.responses?.[0]?.responseText?.trim().length > 0;
    const saved = q?.responses?.[0]?.responseText;
    const temp = responses[idx];
    return (temp && temp.trim().length > 0) || (saved && saved.trim().length > 0);
  });

  const handleResponseChange = (e) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion]: e.target.value
    }));
  };

  const handleSaveResponse = async () => {
    const resp = (responses[currentQuestion] || '').trim();
    if (!resp) {
      toast.warning('Introduce una respuesta antes de continuar');
      return;
    }
    try {
      setSubmitting(true);
      const questionId = question._id;
      await responseService.submitResponse({
        questionId,
        interviewId,
        responseText: resp
      });
      toast.success('Respuesta guardada');
      await fetchInterview();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar respuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteInterview = async () => {
    try {
      setSubmitting(true);
      await interviewService.updateInterviewStatus(interviewId, { status: 'completed' });
      toast.success('¡Entrevista completada!');
      setTimeout(() => navigate('/interviews'), 1200);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar la entrevista');
    } finally {
      setSubmitting(false);
    }
  };

  const handleListenToggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else if (recognitionRef.current) {
      setUserAnswer('');
      userAnswerRef.current = '';
      setElapsedTime(0);
      recognitionRef.current.start();
      setIsListening(true);
      setVoiceStatus('Escuchando...');
    }
  };

  const handleConfirmAnswer = () => {
    if (!userAnswer.trim()) return;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion]: userAnswer.trim()
    }));
    setIsConfirming(false);
    setUserAnswer('');
    userAnswerRef.current = '';
    setElapsedTime(0);
    setVoiceStatus('Respuesta confirmada. Procede al siguiente paso.');
  };

  const handleRetryAnswer = () => {
    setIsConfirming(false);
    setUserAnswer('');
    userAnswerRef.current = '';
    setElapsedTime(0);
    setVoiceStatus('Puedes empezar a grabar de nuevo cuando quieras.');
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (loading) {
    return (
      <div className="interview-session__loading">
        <div className="interview-session__loading-spinner"></div>
      </div>
    );
  }
  if (!interview || !questions.length) {
    return <div className={`interview-session__empty ${isDark ? 'interview-session__empty--dark' : ''}`}>{t('interview.noInterviews')}</div>;
  }

  return (
    <div className={`interview-session ${isDark ? 'interview-session--dark' : ''}`}>
      <div className="interview-session__container">
        <div className="interview-session__header">
          <div className="interview-session__title-row">
            <h1 className={`interview-session__title ${isDark ? 'interview-session__title--dark' : ''}`}>
              {interview?.title}
            </h1>
            <span className={`interview-session__question-counter ${isDark ? 'interview-session__question-counter--dark' : ''}`}>
              {currentQuestion + 1} / {questions.length}
            </span>
          </div>
          <div className={`interview-session__progress-track ${isDark ? 'interview-session__progress-track--dark' : ''}`}>
            <div
              className="interview-session__progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className={`interview-session__card ${isDark ? 'interview-session__card--dark' : ''}`}>
          <div className="interview-session__question-header">
            <div className="interview-session__question-number">
              {currentQuestion + 1}
            </div>
            <p className={`interview-session__question-difficulty ${isDark ? 'interview-session__question-difficulty--dark' : ''}`}>
              {t('interview.difficulty')}: {question?.difficulty || 'unknown'}
            </p>
          </div>

          <h2 className={`interview-session__question-text ${isDark ? 'interview-session__question-text--dark' : ''}`}>
            {question?.questionText || question?.question || 'Question not found'}
          </h2>

          <div className="interview-session__answer-section">
            <label className={`interview-session__answer-label ${isDark ? 'interview-session__answer-label--dark' : ''}`}>
              {t('interview.answer')}
            </label>

            {isCompleted ? (
              <div className={`interview-session__response-display ${isDark ? 'interview-session__response-display--dark' : ''}`}>
                {responseSaved ? responseSaved : <span className="interview-session__no-response">{t('interview.noResponse')}</span>}
              </div>
            ) : isInProgress ? (
              <div>
                {/* Área de entrada con reconocimiento de voz o textarea */}
                {isConfirming ? (
                  <div className={`interview-session__confirming-box ${isDark ? 'interview-session__confirming-box--dark' : ''}`}>
                    <p className="interview-session__confirming-title">{t('interview.pendingConfirmation')}</p>
                    <p className="interview-session__confirming-text">{userAnswer}</p>
                  </div>
                ) : (
                  <textarea
                    value={localResponse || userAnswer}
                    onChange={handleResponseChange}
                    disabled={isListening || submitting}
                    className={`interview-session__textarea ${isDark ? 'interview-session__textarea--dark' : ''}`}
                    rows="6"
                    placeholder={t('interview.unansweredQuestion')}
                  />
                )}

                {/* Estado del reconocimiento de voz */}
                {voiceStatus && (
                  <div className={`interview-session__voice-status ${isDark ? 'interview-session__voice-status--dark' : ''}`}>
                    {voiceStatus}
                  </div>
                )}

                {/* Tiempos */}
                {(isListening || isConfirming) && (
                  <div className={`interview-session__timers ${isDark ? 'interview-session__timers--dark' : ''}`}>
                    <span>{t('interview.responseTime')}: {formatTime(elapsedTime)}</span>
                    <span>{t('interview.totalTime')}: {formatTime(totalTime)}</span>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="interview-session__actions">
                  {isConfirming ? (
                    <>
                      <button
                        onClick={handleRetryAnswer}
                        className="interview-session__button interview-session__button--retry"
                      >
                        {t('interview.retryAnswer')}
                      </button>
                      <button
                        onClick={handleConfirmAnswer}
                        className="interview-session__button interview-session__button--confirm"
                      >
                        {t('interview.confirmAnswer')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleListenToggle}
                        disabled={submitting}
                        className={`interview-session__button interview-session__button--mic ${isListening ? 'interview-session__button--mic--listening' : ''}`}
                      >
                        <MicrophoneIcon />
                        {isListening ? t('interview.stop') : t('interview.record')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveResponse}
                        disabled={submitting || localResponse.trim().length === 0}
                        className="interview-session__button interview-session__button--save"
                      >
                        {t('interview.saveResponse')}
                      </button>
                    </>
                  )}
                </div>

                <p className={`interview-session__hint ${isDark ? 'interview-session__hint--dark' : ''}`}>
                  {!isConfirming && (isListening ? t('interview.clickMicToStop') : t('interview.clickMicToRecord'))}
                </p>
              </div>
            ) : null}
          </div>

          <div className="interview-session__nav">
            {currentQuestion > 0 && (
              <button
                onClick={() => setCurrentQuestion(currentQuestion - 1)}
                className={`interview-session__nav-button ${isDark ? 'interview-session__nav-button--dark' : ''}`}
              >
                <FiArrowLeft /> {t('interview.previousQuestion')}
              </button>
            )}
            {currentQuestion < questions.length - 1 && (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                className={`interview-session__nav-button ${isDark ? 'interview-session__nav-button--dark' : ''}`}
              >
                {t('interview.nextQuestion')} <FiArrowRight />
              </button>
            )}
            <div className="interview-session__nav-spacer"></div>
            {currentQuestion === questions.length - 1
              ? (isCompleted ? (
                  <button
                    onClick={() => navigate('/interviews')}
                    className="interview-session__exit-button"
                  >
                    <FiX /> {t('interview.exit')}
                  </button>
                ) : isInProgress && allAnswered ? (
                  <button
                    onClick={handleCompleteInterview}
                    disabled={submitting}
                    className="interview-session__complete-button"
                  >
                    <FiCheck /> {t('interview.completeInterview')}
                  </button>
                ) : isInProgress ? (
                  <button
                    onClick={() => navigate('/interviews')}
                    className="interview-session__exit-button"
                  >
                    <FiX /> {t('interview.exit')}
                  </button>
                ) : null)
              : (
                <button
                  onClick={() => navigate('/interviews')}
                  className="interview-session__exit-button"
                >
                  <FiX /> {t('interview.exit')}
                </button>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;