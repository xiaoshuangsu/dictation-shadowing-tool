'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { categoryToSlug } from '@/lib/utils/category';
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
  } | null;
}

export function TrainingModeModal({ isOpen, onClose, material }: TrainingModeModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // 🔴 防御性加固：使用 useRef 存储 AbortController，防止重复加载
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🔴 第三阶段：静默异步预加载（不阻塞主线程）
  useEffect(() => {
    if (isOpen && material) {
      console.log('🔍 [TrainingModeModal] 开始预加载素材:', material.title);
      setPreloadStatus('loading');
      preloadAssets();
    }

    // 🔴 防御性加固：cleanup 函数取消正在进行的预加载
    return () => {
      if (abortControllerRef.current) {
        console.log('⚠️ [TrainingModeModal] 取消未完成的预加载请求');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, material]);

  const preloadAssets = async () => {
    if (!material?.audio_path) {
      console.log('⚠️ [TrainingModeModal] 素材没有音频路径，跳过预加载');
      return;
    }

    // 🔴 防御性加固：创建新的 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // 1. 预加载音频（Promise 包装，不阻塞主线程）
      const audioUrl = `https://media.shadowhub.app/${material.audio_path}`;
      console.log('🔍 [TrainingModeModal] 开始预加载音频:', audioUrl);

      await preloadAudio(audioUrl, signal);

      // 2. 预加载挖空数据（Promise 包装，不阻塞主线程）
      console.log('🔍 [TrainingModeModal] 开始预加载挖空数据:', `/api/cloze/${material.id}`);
      await preloadClozeData(material.id, signal);

      console.log('✅ [TrainingModeModal] 预加载完成:', material.title);
      setPreloadStatus('success');
    } catch (error) {
      // 🔴 防御性加固：检查是否是用户取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ [TrainingModeModal] 预加载被用户取消');
        return;
      }

      console.error('❌ [TrainingModeModal] 预加载失败:', material.title, error);
      // 🔴 容错处理：预加载失败不影响用户操作，静默失败
      setPreloadStatus('error');
    }
  };

  // 🔴 预加载音频（Promise 包装 + 超时机制 + AbortController）
  const preloadAudio = (url: string, signal: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 🔴 防御性加固：检查是否已取消
      if (signal.aborted) {
        reject(new Error('AbortError'));
        return;
      }

      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';

      // 设置超时（5秒），避免无限等待
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ [TrainingModeModal] 音频预加载超时:', url);
        resolve(); // 超时不算失败，继续执行
      }, 5000);

      // 🔴 防御性加固：监听 abort 事件
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('AbortError'));
      });

      // 监听加载完成事件
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeoutId);
        console.log('✅ [TrainingModeModal] 音频可以播放:', url);
        resolve();
      }, { once: true });

      // 监听加载失败事件
      audio.addEventListener('error', () => {
        clearTimeout(timeoutId);
        console.error('❌ [TrainingModeModal] 音频加载失败:', url, audio.error);
        reject(new Error(`音频加载失败: ${audio.error?.message}`));
      }, { once: true });

      // 开始加载
      audio.load();
    });
  };

  // 🔴 预加载挖空数据（Promise 包装 + 超时机制 + AbortController）
  const preloadClozeData = async (materialId: string, signal: AbortSignal): Promise<void> => {
    const controller = new AbortController();

    // 🔴 防御性加固：链式 AbortController
    signal.addEventListener('abort', () => controller.abort());

    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

    try {
      const response = await fetch(`/api/cloze/${materialId}`, {
        signal: controller.signal
      });

      if (response.ok) {
        await response.json();
        console.log('✅ [TrainingModeModal] 挖空数据缓存成功');
      } else {
        console.warn('⚠️ [TrainingModeModal] 挖空数据返回非 200 状态:', response.status);
      }
    } catch (error) {
      // 🔴 防御性加固：检查是否是取消操作
      if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
        console.log('⚠️ [TrainingModeModal] 挖空数据预加载被取消');
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⚠️ [TrainingModeModal] 挖空数据预加载超时');
      } else {
        console.warn('⚠️ [TrainingModeModal] 挖空数据预加载失败:', error);
      }
      // 不抛出错误，静默失败
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleModeSelect = (mode: TrainingMode) => {
    if (!material) {
      console.error('❌ [TrainingModeModal] 没有选中素材，无法跳转');
      return;
    }

    console.log('🔍 [TrainingModeModal] 用户选择模式:', mode, '素材:', material.title, '预加载状态:', preloadStatus);

    setIsLoading(true);

    // 🔴 防御性加固：URL 路径安全化
    // 1. 将中文分类转换为英文 slug
    const categorySlug = categoryToSlug(material.category);

    // 2. 使用 encodeURIComponent 进行编码，防止特殊字符和乱码
    const encodedCategorySlug = encodeURIComponent(categorySlug);
    const encodedMaterialSlug = encodeURIComponent(material.slug);

    // 3. 强制格式检查：确保使用查询参数模式（不是路径模式）
    const practiceUrl = `/topics/${encodedCategorySlug}/${encodedMaterialSlug}/?mode=${mode}`;

    // 🔴 日志增强：输出完整编码后的 URL，方便控制台点击测试
    const fullUrl = `http://localhost:3000${practiceUrl}`;
    console.log('🔍 [TrainingModeModal] 跳转到:', fullUrl);
    console.log('🔍 [TrainingModeModal] 路径组成:', {
      category: material.category,
      categorySlug,
      encodedCategorySlug,
      materialSlug: material.slug,
      encodedMaterialSlug,
      mode,
      finalUrl: practiceUrl
    });

    router.push(practiceUrl);

    // 延迟关闭，确保跳转已经开始
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
        {/* 关闭按钮 */}
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* 标题 */}
        <div className="modal-header">
          <h2 className="modal-title">Select Training Mode</h2>
        </div>

        {/* 双选项布局 */}
        <div className="mode-options">
          {/* Dictation 选项 */}
          <button
            className="mode-card mode-card-dictation"
            onClick={() => handleModeSelect('dictation')}
            disabled={isLoading}
          >
            <div className="mode-icon">
              {/* 纯白纸张 */}
              <svg className="paper-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 纸张主体 */}
                <rect x="12" y="8" width="40" height="48" rx="2" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1"/>
                {/* 纸张折角 */}
                <path d="M44 48L52 56V48H44Z" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/>
                {/* 纸张横线 */}
                <line x1="18" y1="20" x2="46" y2="20" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="28" x2="46" y2="28" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="36" x2="46" y2="36" stroke="#E5E7EB" strokeWidth="1"/>
                <line x1="18" y1="44" x2="38" y2="44" stroke="#E5E7EB" strokeWidth="1"/>
              </svg>

              {/* 紫色笔 */}
              <svg className="pen-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 笔杆 */}
                <path d="M20 52L44 28L48 32L24 56L20 52Z" fill="#9333EA"/>
                {/* 笔尖 */}
                <path d="M20 52L16 56L20 56L24 52L20 52Z" fill="#7C3AED"/>
                {/* 笔杆高光 */}
                <path d="M22 50L42 30" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"/>
                {/* 笔帽装饰环 */}
                <rect x="44" y="28" width="4" height="8" rx="1" fill="#A78BFA"/>
              </svg>
            </div>
            <div className="mode-content">
              <h3 className="mode-label">Dictation</h3>
              <p className="mode-hint">Gap Fill Exercise</p>
            </div>
          </button>

          {/* Shadowing 选项 */}
          <button
            className="mode-card mode-card-shadowing"
            onClick={() => handleModeSelect('shadowing')}
            disabled={isLoading}
          >
            <div className="mode-icon">
              {/* 紫色头戴式耳机 */}
              <svg className="headphones-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 头梁 */}
                <path d="M12 36V32C12 20.954 20.954 12 32 12C43.046 12 52 20.954 52 32V36" stroke="#9333EA" strokeWidth="4" strokeLinecap="round"/>
                {/* 头梁阴影 */}
                <path d="M12 36V32C12 20.954 20.954 12 32 12C43.046 12 52 20.954 52 32V36" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>

                {/* 左耳罩 */}
                <rect x="8" y="32" width="12" height="20" rx="6" fill="#9333EA"/>
                <rect x="8" y="32" width="12" height="20" rx="6" fill="url(#gradientLeft)" fill-opacity="0.2"/>
                {/* 左耳罩高光 */}
                <rect x="10" y="34" width="6" height="8" rx="3" fill="#A78BFA" opacity="0.4"/>

                {/* 右耳罩 */}
                <rect x="44" y="32" width="12" height="20" rx="6" fill="#9333EA"/>
                <rect x="44" y="32" width="12" height="20" rx="6" fill="url(#gradientRight)" fill-opacity="0.2"/>
                {/* 右耳罩高光 */}
                <rect x="48" y="34" width="6" height="8" rx="3" fill="#A78BFA" opacity="0.4"/>

                {/* 渐变定义 */}
                <defs>
                  <linearGradient id="gradientLeft" x1="8" y1="32" x2="20" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="100%" stop-color="#000000"/>
                  </linearGradient>
                  <linearGradient id="gradientRight" x1="44" y1="32" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="100%" stop-color="#000000"/>
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
