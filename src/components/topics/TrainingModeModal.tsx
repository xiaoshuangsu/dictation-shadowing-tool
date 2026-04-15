'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { categoryToSlug } from '@/lib/utils/category';
import { buildPageUrl } from '@/lib/utils/url';
import logger from '@/lib/utils/logger';
import './TrainingModeModal.css';

export type TrainingMode = 'dictation' | 'shadowing';

interface TrainingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: {
    id: string;
    title: string;
    category: string;
    slug: string;
    audio_path: string | null;
    source_type?: 'r2' | 'youtube' | null;  // 🔥 新增：素材类型
  } | null;
}

export function TrainingModeModal({ isOpen, onClose, material }: TrainingModeModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen && material) {
      logger.debug('[TrainingModeModal] 开始预加载素材:', material.title);
      setPreloadStatus('loading');
      preloadAssets();
    }

    return () => {
      if (abortControllerRef.current) {
        logger.debug('[TrainingModeModal] 取消未完成的预加载请求');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, material]);

  const preloadAssets = async () => {
    // 🔥 YouTube 素材跳过音频预加载（无 R2 音频文件）
    if (material?.source_type === 'youtube') {
      logger.debug('[TrainingModeModal] YouTube 素材，跳过音频预加载');
      // 仍然预加载挖空数据
      if (material.id) {
        try {
          await preloadClozeData(material.id, new AbortController().signal);
        } catch (error) {
          console.error('[TrainingModeModal] 挖空数据预加载失败:', error);
        }
      }
      setPreloadStatus('success');
      return;
    }

    if (!material?.audio_path) {
      logger.debug('[TrainingModeModal] 素材没有音频路径，跳过预加载');
      return;
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const audioUrl = material.audio_path.startsWith('http')
        ? material.audio_path
        : `https://media.shadowhub.app/${material.audio_path}`;
      logger.debug('[TrainingModeModal] 开始预加载音频:', audioUrl);

      await preloadAudio(audioUrl, signal);

      logger.debug('[TrainingModeModal] 开始预加载挖空数据:', `/api/cloze/${material.id}`);
      await preloadClozeData(material.id, signal);

      logger.debug('[TrainingModeModal] 预加载完成:', material.title);
      setPreloadStatus('success');
    } catch (error) {
      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message === 'AbortError'
      );

      if (isAbortError) {
        logger.debug('[TrainingModeModal] 预加载被用户取消（跳转或关闭弹窗）');
        return;
      }

      console.error('[TrainingModeModal] 预加载失败:', material.title, error);
      setPreloadStatus('error');
    }
  };

  const preloadAudio = (url: string, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';

      const timeoutId = setTimeout(() => {
        logger.debug('[TrainingModeModal] 音频预加载超时:', url);
        resolve();
      }, 5000);

      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });

      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeoutId);
        logger.debug('[TrainingModeModal] 音频可以播放:', url);
        resolve();
      }, { once: true });

      audio.addEventListener('error', () => {
        clearTimeout(timeoutId);
        console.error('[TrainingModeModal] 音频加载失败:', url, audio.error);
        reject(new Error(`音频加载失败: ${audio.error?.message}`));
      }, { once: true });

      audio.load();
    });
  };

  const preloadClozeData = async (materialId: string, signal: AbortSignal): Promise<void> => {
    const controller = new AbortController();

    signal.addEventListener('abort', () => controller.abort());

    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`/api/cloze/${materialId}`, {
        signal: controller.signal
      });

      if (response.ok) {
        await response.json();
        logger.debug('[TrainingModeModal] 挖空数据缓存成功');
      } else {
        logger.debug('[TrainingModeModal] 挖空数据返回非 200 状态:', response.status);
      }
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
        logger.debug('[TrainingModeModal] 挖空数据预加载被取消');
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('[TrainingModeModal] 挖空数据预加载超时');
      } else {
        logger.debug('[TrainingModeModal] 挖空数据预加载失败:', error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleModeSelect = (mode: TrainingMode) => {
    if (!material) {
      console.error('[TrainingModeModal] 没有选中素材，无法跳转');
      return;
    }

    logger.debug('[TrainingModeModal] 用户选择模式:', mode, '素材:', material.title, '预加载状态:', preloadStatus);

    setIsLoading(true);

    const categorySlug = categoryToSlug(material.category);

    const encodedCategorySlug = encodeURIComponent(categorySlug);
    const encodedMaterialSlug = encodeURIComponent(material.slug);

    const practiceUrl = `/topics/${encodedCategorySlug}/${encodedMaterialSlug}/?mode=${mode}`;

    const fullUrl = buildPageUrl(practiceUrl);
    logger.debug('[TrainingModeModal] 跳转到:', fullUrl);
    logger.debug('[TrainingModeModal] 路径组成:', {
      category: material.category,
      categorySlug,
      encodedCategorySlug,
      materialSlug: material.slug,
      encodedMaterialSlug,
      mode,
      finalUrl: practiceUrl
    });

    router.push(practiceUrl);

    setTimeout(() => {
      onClose();
      setIsLoading(false);
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`training-mode-modal ${isOpen ? 'active' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className="modal-container">
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="modal-header">
          <h2 className="modal-title">Select Training Mode</h2>
        </div>

        <div className="mode-options">
          <button
            className="mode-card mode-card-dictation"
            onClick={() => handleModeSelect('dictation')}
            disabled={isLoading}
          >
            <div className="mode-icon">
              <svg className="paper-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="12" y="8" width="40" height="48" rx="2" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1"/>
                <path d="M44 48L52 56V48H44Z" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="20" x2="46" y2="20" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="28" x2="46" y2="28" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="36" x2="46" y2="36" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="44" x2="38" y2="44" stroke="#E5E7EB" strokeWidth="1"/>
              </svg>

              <svg className="pen-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 52L44 28L48 32L24 56L20 52Z" fill="#9333EA"/>
                <path d="M20 52L16 56L20 56L24 52L20 52Z" fill="#7C3AED"/>
                <path d="M22 50L42 30" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
                <rect x="44" y="28" width="4" height="8" rx="1" fill="#A78BFA"/>
              </svg>
            </div>
            <div className="mode-content">
              <h3 className="mode-label">Dictation</h3>
              <p className="mode-hint">Gap Fill Exercise</p>
            </div>
          </button>

          <button
            className="mode-card mode-card-shadowing"
            onClick={() => handleModeSelect('shadowing')}
            disabled={isLoading}
          >
            <div className="mode-icon">
              <svg className="headphones-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 36V32C12 20.954 20.954 12 32 12C43.046 12 52 20.954 52 32V36" stroke="#9333EA" strokeWidth="4" strokeLinecap="round"/>
                <path d="M12 36V32C12 20.954 20.954 12 32 12C43.046 12 52 20.954 52 32V36" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>

                <rect x="8" y="32" width="12" height="20" rx="6" fill="#9333EA"/>
                <rect x="8" y="32" width="12" height="20" rx="6" fill="url(#gradientLeft)" fillOpacity="0.2"/>
                <rect x="10" y="34" width="6" height="8" rx="3" fill="#A78BFA" opacity="0.4"/>

                <rect x="44" y="32" width="12" height="20" rx="6" fill="#9333EA"/>
                <rect x="44" y="32" width="12" height="20" rx="6" fill="url(#gradientRight)" fillOpacity="0.2"/>
                <rect x="48" y="34" width="6" height="8" rx="3" fill="#A78BFA" opacity="0.4"/>

                <defs>
                  <linearGradient id="gradientLeft" x1="8" y1="32" x2="20" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF"/>
                    <stop offset="100%" stopColor="#000000"/>
                  </linearGradient>
                  <linearGradient id="gradientRight" x1="44" y1="32" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF"/>
                    <stop offset="100%" stopColor="#000000"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="mode-content">
              <h3 className="mode-label">Shadowing</h3>
              <p className="mode-hint">Speaking Practice</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
