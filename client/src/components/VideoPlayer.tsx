import { useRef, useEffect } from "react";

interface VideoPlayerProps {
  url: string;
  className?: string;
  onEnded?: () => void;
  onTimeUpdate?: (percent: number) => void;
  autoPlay?: boolean;
  controls?: boolean;
  playbackRate?: number;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/watch\?.*v=([^&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

export default function VideoPlayer({
  url,
  className = "",
  onEnded,
  onTimeUpdate,
  autoPlay = false,
  controls = true,
  playbackRate = 1,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const youtubeId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      ...(autoPlay ? { autoplay: "1" } : {}),
    });
    const embedUrl = `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
    return (
      <div className={`relative w-full aspect-video ${className}`}>
        <iframe
          src={embedUrl}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full rounded-none"
          style={{ border: "none" }}
        />
      </div>
    );
  }

  if (vimeoId) {
    const params = new URLSearchParams({
      ...(autoPlay ? { autoplay: "1" } : {}),
      color: "2d7a5f",
      title: "0",
      byline: "0",
      portrait: "0",
    });
    const embedUrl = `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
    return (
      <div className={`relative w-full aspect-video ${className}`}>
        <iframe
          src={embedUrl}
          title="Vimeo video player"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          style={{ border: "none" }}
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={`w-full aspect-video ${className}`}
      controls={controls}
      autoPlay={autoPlay}
      onTimeUpdate={(e) => {
        if (onTimeUpdate) {
          const video = e.currentTarget;
          if (video.duration) {
            onTimeUpdate((video.currentTime / video.duration) * 100);
          }
        }
      }}
      onEnded={onEnded}
    >
      <source src={url} />
      Seu navegador nao suporta videos HTML5.
    </video>
  );
}
