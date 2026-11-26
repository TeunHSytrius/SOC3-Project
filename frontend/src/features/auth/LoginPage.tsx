import { useState, type FormEvent } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function LoginPage({ error, busy, onSubmit }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="login-page">
      <header className="login-header">
        <div className="login-brand">
          <span className="login-brand-icon" aria-hidden="true">
            SOC
          </span>
          <span>SOC Management</span>
        </div>
        <span className="login-header-text">SOC-platform</span>
      </header>

      <section className="login-content">
        <div className="login-intro">
          <h1>Inloggen</h1>
          <p>Log in om beveiligingsmeldingen en onderzoeken te beheren.</p>
        </div>

        <form className="login-form" onSubmit={onSubmit} aria-busy={busy}>
          <div className="login-field">
            <label htmlFor="username">Gebruikersnaam of e-mailadres</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Wachtwoord</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="login-field">
            <label htmlFor="code">2FA- of herstelcode (indien ingesteld)</label>
            <input id="code" name="code" autoComplete="one-time-code" placeholder="Optioneel" />
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? 'Bezig met inloggen...' : 'Inloggen'}
          </button>
        </form>

        <details className="login-demo">
          <summary>Demonstratieaccounts</summary>
          <p>
            Wachtwoord voor alle demoaccounts: <code>Demo2026!</code>
          </p>
          <p>Projectgroep 3</p>
          <div className="login-demo-options">
            {[
              { name: 'Teun', login: 'teun' },
              { name: 'Dominique', login: 'dominique' },
              { name: 'Sergio', login: 'sergio' },
              { name: 'Hamza', login: 'hamza' },
              { name: 'Ruben', login: 'ruben' },
              { name: 'Thijs', login: 'thijs' },
            ].map((member) => (
              <button
                type="button"
                key={member.login}
                onClick={() => {
                  setUsername(member.login + '@soc.demo');
                  setPassword('Demo2026!');
                }}
              >
                {member.name}
              </button>
            ))}
          </div>
          <p>Algemene testaccounts</p>
          <div className="login-demo-options">
            {['analist', 'senior', 'beheerder', 'klant', 'accountmanager'].map((role) => (
              <button
                type="button"
                key={role}
                onClick={() => {
                  setUsername(role + '@soc.demo');
                  setPassword('Demo2026!');
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </details>
        <p className="login-footer">SOC Casemanagementplatform</p>
      </section>
    </main>
  );
}
