export type AttendanceSoundType = "check" | "uncheck" | "error";

const getAudioContext = () =>
  typeof window === "undefined"
    ? null
    : new (window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
        null)();

export const playAttendanceSound = (type: AttendanceSoundType) => {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "square";
    gain.gain.value = 0.12;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    if (type === "check") {
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12,
      );
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);
    } else if (type === "uncheck") {
      oscillator.frequency.value = 660;
      oscillator.frequency.exponentialRampToValueAtTime(
        520,
        audioContext.currentTime + 0.14,
      );
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.14,
      );
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.14);
    } else {
      oscillator.frequency.value = 220;
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.2,
      );
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  } catch {
    // ignore audio errors
  }
};
