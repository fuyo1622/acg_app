import { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import './ImageUploader.css';

export default function ImageUploader({ defaultImage, onImageSelected }) {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (defaultImage && defaultImage instanceof Blob) {
      const url = URL.createObjectURL(defaultImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [defaultImage]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageSelected(file);
    }
  };

  const clearImage = (e) => {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onImageSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="image-uploader glass-panel">
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      {previewUrl ? (
        <div className="preview-container">
          <img src={previewUrl} alt="Preview" className="preview-image" />
          <button type="button" className="clear-btn" onClick={clearImage}>
            <X size={20} />
          </button>
          <div className="change-overlay" onClick={() => fileInputRef.current?.click()}>
            <Camera size={24} />
            <span>{t('tapToChange')}</span>
          </div>
        </div>
      ) : (
        <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
          <div className="upload-icon-wrapper">
            <Upload size={32} color="var(--accent-primary)" />
          </div>
          <h3>{t('addPhoto')}</h3>
          <p>{t('tapToTake')}</p>
        </div>
      )}
    </div>
  );
}
