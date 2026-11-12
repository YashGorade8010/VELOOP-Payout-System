import { ArrowRight } from 'lucide-react';

export default function AuthDialog({
  styles,
  mode,
  authMode,
  authForm,
  setAuthForm,
  busy,
  setModal,
  signIn,
  register,
  requestPasswordReset,
  resetPassword,
}) {
  if (mode === 'reset-sent') {
    return (
      <>
        <span className={styles.modalEyebrow}>CHECK YOUR EMAIL</span>
        <h2 id="modal-title">Check your inbox</h2>
        <p>
          If an account exists for that email, a password reset link has been sent. The link expires
          in 30 minutes.
        </p>
        <button className={styles.redeemButton} onClick={() => setModal('auth')}>
          Back to sign in <ArrowRight size={16} />
        </button>
      </>
    );
  }

  if (mode === 'forgot') {
    return (
      <>
        <span className={styles.modalEyebrow}>ACCOUNT RECOVERY</span>
        <h2 id="modal-title">Reset your password</h2>
        <p>Enter the email address linked to your VELOOP account.</p>
        <form className={styles.form} onSubmit={requestPasswordReset}>
          <label>
            Email address
            <input
              autoFocus
              required
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              autoComplete="email"
            />
          </label>
          <button className={styles.redeemButton} disabled={busy}>
            {busy ? 'Please wait…' : 'Send reset link'} <ArrowRight size={16} />
          </button>
        </form>
        <button className={styles.linkButton} onClick={() => setModal('auth')}>
          Back to sign in
        </button>
      </>
    );
  }

  if (mode === 'reset') {
    return (
      <>
        <span className={styles.modalEyebrow}>ACCOUNT RECOVERY</span>
        <h2 id="modal-title">Choose a new password</h2>
        <p>Your password must contain at least 10 characters.</p>
        <form className={styles.form} onSubmit={resetPassword}>
          <label>
            New password
            <input
              autoFocus
              required
              minLength={10}
              maxLength={100}
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              autoComplete="new-password"
            />
          </label>
          <button className={styles.redeemButton} disabled={busy}>
            {busy ? 'Please wait…' : 'Update password'} <ArrowRight size={16} />
          </button>
        </form>
        <button className={styles.linkButton} onClick={() => setModal('auth')}>
          Back to sign in
        </button>
      </>
    );
  }

  return (
    <>
      <span className={styles.modalEyebrow}>
        {authMode === 'admin' ? 'ADMIN WORKSPACE' : 'YOUR VELOOP ACCOUNT'}
      </span>
      <h2 id="modal-title">
        {mode === 'register'
          ? 'Create your account'
          : authMode === 'admin'
            ? 'Admin sign in'
            : 'Welcome back'}
      </h2>
      <p>
        {authMode === 'admin'
          ? 'Sign in with your provisioned admin credentials.'
          : 'Sign in to see your wallet and redeem rewards.'}
      </p>
      <form className={styles.form} onSubmit={mode === 'register' ? register : signIn}>
        {mode === 'register' && (
          <label>
            Your name
            <input
              required
              value={authForm.name}
              onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            required
            type="email"
            value={authForm.email}
            onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            required
            minLength={mode === 'register' ? 10 : undefined}
            type="password"
            value={authForm.password}
            onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {mode === 'register' && <small>Use at least 10 characters for your password.</small>}
        </label>
        <button className={styles.redeemButton} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}{' '}
          <ArrowRight size={16} />
        </button>
      </form>
      {authMode !== 'admin' && (
        <div className={styles.authLinks}>
          {mode === 'auth' && (
            <button className={styles.linkButton} onClick={() => setModal('forgot')}>
              Forgot password?
            </button>
          )}
          <button
            className={styles.linkButton}
            onClick={() => setModal(mode === 'register' ? 'auth' : 'register')}
          >
            {mode === 'register'
              ? 'Already have an account? Sign in'
              : 'New to VELOOP? Create an account'}
          </button>
        </div>
      )}
      {authMode === 'admin' && (
        <p className={styles.demoHint}>
          Demo admin credentials are provisioned on the API host. No production password is shown
          here.
        </p>
      )}
    </>
  );
}
