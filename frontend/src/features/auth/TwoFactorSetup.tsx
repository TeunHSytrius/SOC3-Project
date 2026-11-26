import { useState } from 'react';
import type { FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { enableTwoFactor, startTwoFactorSetup } from '../../services/twoFactor';
import { ApiError } from '../../services/api';
import type { TwoFactorSetupResponse } from '../../types/twoFactor';
import './TwoFactorSetup.css';

type Step = 'start' | 'scan' | 'done';

// Adapted from feature/tg-39-two-factor-auth; the server identifies the signed-in account.
function TwoFactorSetup({
  email,
  initiallyEnabled,
  onEnabled,
  onSessionExpired,
}: {
  email: string;
  initiallyEnabled: boolean;
  onEnabled: () => Promise<void>;
  onSessionExpired: (error: unknown) => void;
}) {
  const [step, setStep] = useState<Step>('start');
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runRequest(request: () => Promise<void>) {
    setError(null);
    setIsLoading(true);

    try {
      await request();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) onSessionExpired(caught);
      setError(caught instanceof Error ? caught.message : 'Er ging iets mis.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runRequest(async () => {
      const response = await startTwoFactorSetup();
      setSetup(response);
      setStep('scan');
    });
  }

  function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runRequest(async () => {
      const response = await enableTwoFactor({ code });
      setRecoveryCodes(response.recoveryCodes);
      setSetup(null);
      setCode('');
      setStep('done');
      await onEnabled();
    });
  }

  if (initiallyEnabled && step === 'start')
    return <p>Tweestapsverificatie is actief voor dit account.</p>;

  return (
    <section className="two-factor-setup">
      <h2>Tweestapsverificatie instellen</h2>

      {step === 'start' && (
        <form className="two-factor-form" onSubmit={handleStart}>
          <p>
            Account: <strong>{email}</strong>
          </p>
          <p>Koppel een authenticator-app aan je eigen account.</p>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Bezig...' : 'QR-code maken'}
          </button>
        </form>
      )}

      {step === 'scan' && setup !== null && (
        <div className="two-factor-result">
          <ol>
            <li>
              Open Microsoft Authenticator, Google Authenticator of een andere TOTP-app op je
              telefoon.
            </li>
            <li>
              Tik op <strong>+</strong> en kies{' '}
              <strong>Ander account (Google, Facebook, enz.)</strong>.
            </li>
            <li>Scan de QR-code hieronder.</li>
            <li>Vul de 6-cijferige code uit de app in.</li>
          </ol>

          <div className="two-factor-qr">
            <QRCodeSVG value={setup.otpAuthUri} size={200} bgColor="#ffffff" fgColor="#000000" />
          </div>

          <p>Lukt scannen niet? Voer deze sleutel handmatig in:</p>
          <code className="two-factor-key">{setup.manualEntryKey}</code>

          <form className="two-factor-form" onSubmit={handleEnable}>
            <label htmlFor="two-factor-code">Code uit de app</label>
            <input
              id="two-factor-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              required
            />

            <button type="submit" disabled={isLoading || code.length !== 6}>
              {isLoading ? 'Bezig...' : 'Activeren'}
            </button>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="two-factor-result">
          <p className="two-factor-success">Tweestapsverificatie is ingeschakeld.</p>

          <p>
            <strong>Bewaar deze herstelcodes op een veilige plek.</strong> Ben je je telefoon kwijt,
            dan kun je met één van deze codes toch inloggen. Elke code werkt maar één keer en je
            ziet ze hierna niet meer terug.
          </p>

          <ul className="two-factor-recovery-codes">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>
                <code>{recoveryCode}</code>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              void runRequest(async () => {
                await navigator.clipboard.writeText(recoveryCodes.join('\n'));
              })
            }
          >
            Kopieer codes
          </button>
        </div>
      )}

      {error !== null && (
        <p className="two-factor-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default TwoFactorSetup;
