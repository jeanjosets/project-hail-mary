import React, { useState, useEffect, useRef } from 'react';
import { Shield, BookOpen, Key, Smile } from 'lucide-react';
import { AppSettings } from '../types';

interface LockScreenProps {
  settings: AppSettings;
  onUnlock: () => void;
}

export default function LockScreen({ settings, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleUnlock = () => {
    if (password === settings.pin) {
      onUnlock();
    } else {
      setError('Incorrect password — try again');
      setPassword('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  const handleBiometric = async () => {
    if (!window.PublicKeyCredential) {
      setError('Biometrics not available in this browser.');
      return;
    }
    try {
      const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!ok) {
        setError('No biometric authenticator found.');
        return;
      }
      // Native WebAuthn credentials retrieval call
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: []
        }
      });
      onUnlock();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(`Biometric failed: ${err.message}`);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const hasBio = settings.bio && typeof window.PublicKeyCredential !== 'undefined';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-7 fade">
      {/* Visual Header / Brand */}
      <div className="w-[74px] h-[74px] rounded-[22px] display grid place-items-center bg-linear-to-br from-[#132726] to-[#0B1716] border border-[rgba(47,212,196,0.16)] shadow-[0_0_50px_rgba(47,212,196,0.14)]">
        <BookOpen className="w-8 h-8 text-[#2FD4C4]" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#EAF2F1]">Project Hail Mary</h1>
        <p className="text-[#84A09D] text-sm mt-1">Your private secure journal</p>
      </div>

      <div className="w-full max-w-[280px] flex flex-col gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your password"
            className="w-full bg-[#0B1716] border border-[rgba(47,212,196,0.16)] rounded-xl text-[#EAF2F1] text-lg p-3.5 outline-none text-center tracking-[4px]"
          />
        </div>

        {error && (
          <p className="text-[#E26D7A] text-xs text-center min-h-[18px] font-semibold">{error}</p>
        )}

        <button
          onClick={handleUnlock}
          className="w-full p-3.5 rounded-xl font-extrabold bg-linear-to-r from-[#2FD4C4] to-[#0E7E78] text-[#04201D] hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Key className="w-4 h-4" /> Unlock
        </button>

        {hasBio && (
          <button
            onClick={handleBiometric}
            className="mt-2 w-full p-3 border border-[rgba(47,212,196,0.16)] rounded-full text-sm font-bold text-[#2FD4C4] bg-[rgba(47,212,196,0.05)] hover:bg-[rgba(47,212,196,0.08)] flex items-center justify-center gap-2 transition"
          >
            <Smile className="w-4 h-4" /> Use Touch ID / Face ID
          </button>
        )}
      </div>
    </div>
  );
}
