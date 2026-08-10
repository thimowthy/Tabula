import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../ui/Modal';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    const ok = mode === 'login' ? await login(username, password) : await register(username, password);
    if (ok) onClose();
  }

  return (
    <Modal title={mode === 'login' ? 'Entrar' : 'Criar conta'} onClose={onClose} width={340}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              clearError();
            }}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: mode === 'login' ? 'var(--color-accent)' : 'var(--color-border)',
              color: mode === 'login' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              clearError();
            }}
            className="flex-1 rounded border px-2 py-1.5 text-[12px]"
            style={{
              borderColor: mode === 'register' ? 'var(--color-accent)' : 'var(--color-border)',
              color: mode === 'register' ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Criar conta
          </button>
        </div>

        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Usuário
          <input
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--color-text-subtle)]">
          Senha
          <input
            type="password"
            className="rounded border px-2 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          {mode === 'register' && <span>Mínimo de 8 caracteres.</span>}
        </label>

        {error && <p className="text-[12px] text-[var(--color-danger)]">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !username.trim() || !password}
          className="rounded px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          {loading ? 'Enviando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </div>
    </Modal>
  );
}
