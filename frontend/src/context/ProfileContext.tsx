import { createContext, useContext, useState, type ReactNode } from 'react';
import { defaultProfile, type Profile } from '../types';

interface Ctx {
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  speak: (text: string) => void;
}

const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(defaultProfile);

  const setProfile = (p: Partial<Profile>) =>
    setProfileState((prev) => ({ ...prev, ...p }));

  const speak = (text: string) => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = profile.ttsRate;
      speechSynthesis.speak(u);
    } catch {
      // no TTS available
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile, speak }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): Ctx {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile outside provider');
  return ctx;
}
