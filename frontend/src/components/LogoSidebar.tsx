import { useEffect, useMemo, useRef, useState } from 'react';

type Size = {
  width: number;
  height: number;
};

type LogoSidebarProps = {
  logoUrl?: string | null;
};

const EMPTY_SIZE: Size = { width: 0, height: 0 };

export function LogoSidebar({ logoUrl }: LogoSidebarProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState<Size>(EMPTY_SIZE);
  const [imageSize, setImageSize] = useState<Size>(EMPTY_SIZE);
  const [isLogoBroken, setIsLogoBroken] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }

    const updateFrameSize = () => {
      const { width, height } = frame.getBoundingClientRect();
      setFrameSize({ width, height });
    };

    updateFrameSize();

    const observer = new ResizeObserver(() => {
      updateFrameSize();
    });
    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setIsLogoBroken(false);
    setImageSize(EMPTY_SIZE);
  }, [logoUrl]);

  const rotatedSize = useMemo(() => {
    if (!logoUrl || isLogoBroken || !frameSize.width || !frameSize.height || !imageSize.width || !imageSize.height) {
      return undefined;
    }

    const scale = Math.min(frameSize.height / imageSize.width, frameSize.width / imageSize.height);
    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    };
  }, [frameSize, imageSize, isLogoBroken, logoUrl]);

  return (
    <aside className="logo-sidebar" aria-label="Брендинг компании">
      <div ref={frameRef} className="logo-sidebar__frame">
        {logoUrl && !isLogoBroken ? (
          <img
            className="logo-sidebar__image"
            src={logoUrl}
            alt="Логотип компании"
            onError={() => setIsLogoBroken(true)}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setImageSize({ width: naturalWidth, height: naturalHeight });
            }}
            style={
              rotatedSize
                ? {
                    width: `${rotatedSize.width}px`,
                    height: `${rotatedSize.height}px`,
                  }
                : undefined
            }
          />
        ) : (
          <div className="logo-sidebar__fallback" aria-hidden="true">
            <span>Спектральный след</span>
          </div>
        )}
      </div>
    </aside>
  );
}
