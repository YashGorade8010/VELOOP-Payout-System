import {
  ArrowRight,
  Check,
  Clock3,
  Coins,
  CircleHelp,
  Gift,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import stylesModule from '../../App.module.css';
import { getMethodDisplayName, METHODS } from '../../constants/methods.js';
import { money } from '../../utils/formatters.js';

export default function PayoutPage({
  styles = stylesModule,
  token,
  balance,
  balanceLoading,
  selectedMethod,
  methodKey,
  config,
  configLoaded,
  activeMethod,
  options,
  eligibilityQuotes,
  optionsLoading,
  optionsError,
  retryOptions,
  refreshPayout,
  busy,
  chooseMethod,
  setNotice,
  startRedemption,
}) {
  const Icon = selectedMethod.icon;
  const methodName = getMethodDisplayName(methodKey, activeMethod?.displayName);
  return (
    <>
      <div className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>
            <span /> YOUR REWARDS, YOUR WAY
          </div>
          <h1>
            Redeem your
            <br />
            <span>rewards.</span>
          </h1>
          <p>Turn your earned VEs into eligible rewards through your preferred payout method.</p>
          <div className={styles.heroMeta}>
            <span>
              <ShieldCheck size={15} /> Secure redemption
            </span>
            <span>
              <Clock3 size={15} /> Tracked from start to finish
            </span>
          </div>
        </div>
        <div className={styles.heroArt}>
          <div className={`${styles.orbit} ${styles.orbitOne}`} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.heroCoin}>
            <Coins size={42} />
            <b>VE</b>
          </div>
          <span className={`${styles.floatChip} ${styles.chipOne}`}>+ reward</span>
          <span className={`${styles.floatChip} ${styles.chipTwo}`}>
            <Check size={13} /> ready to redeem
          </span>
        </div>
      </div>
      <section className={styles.balanceCard}>
        <div className={styles.balanceIcon}>
          <Coins size={23} />
        </div>
        <div className={styles.balanceCopy}>
          <span className={styles.balanceLabel}>
            AVAILABLE BALANCE <CircleHelp size={14} aria-label="Your balance is loaded from your account wallet." />
          </span>
          {balanceLoading ? (
            <span className={styles.balanceSkeleton} aria-label="Loading available VE balance" />
          ) : (
            <strong>
              {balance === null
              ? token
                ? 'Loading…'
                : 'Sign in to view'
              : balance.toLocaleString('en-IN')}
            </strong>
          )}
          <small>
            {balance !== null
              ? 'VEs ready; payout value is shown per configured reward'
              : token
                ? 'Your secure wallet is loading'
                : 'Your wallet balance is private to your account'}
          </small>
        </div>
        <div className={styles.balanceEstimate}>
          {balance !== null && (
            <>
              <span>Current method</span>
              <strong>{methodName}</strong>
            </>
          )}
          <button
            className={styles.refreshButton}
            onClick={refreshPayout}
            aria-label="Refresh balance and reward options"
            disabled={optionsLoading}
          >
            <RefreshCw size={16} className={optionsLoading ? styles.spinIcon : ''} /> Refresh
          </button>
        </div>
      </section>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>CHOOSE YOUR REWARD</span>
          <h2>Select a payout method</h2>
          <p>Choose where you’d like to put your VEs to work.</p>
        </div>
        <span className={styles.stepPill}>
          <i>01</i> SELECT METHOD
        </span>
      </div>
      <div className={styles.methodGrid}>
        {Object.entries(METHODS).map(([key, item]) => {
          const MethodIcon = item.icon;
          const active = key === methodKey;
          const configuredMethod = config.methods.find((m) => m.methodKey === key);
          const available = configuredMethod?.active;
          const configuredName = configuredMethod?.displayName;
          const methodName = getMethodDisplayName(key, configuredName);
          return (
            <button
              key={key}
              disabled={!configLoaded || available !== true}
              onClick={() => chooseMethod(key)}
              className={`${styles.methodCard} ${styles[item.tone]} ${active ? styles.methodSelected : ''}`}
            >
              <span className={styles.methodIcon}>
                <MethodIcon size={21} />
              </span>
              <span className={styles.methodText}>
                <b>{methodName}</b>
                <small>{configuredMethod?.description || item.caption}</small>
                {available !== true && configuredMethod?.maintenanceMessage && (
                  <small className={styles.methodMaintenance}>{configuredMethod.maintenanceMessage}</small>
                )}
              </span>
              <span className={styles.radioMark}>{active && <span />}</span>
              {available !== true && configLoaded && (
                <span className={styles.unavailable}>Unavailable</span>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.rewardHeader}>
        <div className={`${styles.rewardBrand} ${styles[selectedMethod.tone]}`}>
          <Icon size={20} />
        </div>
        <div>
          <h3>{methodName} rewards</h3>
          <p>
            {activeMethod?.description ||
              'Reward values are managed by the platform configuration.'}
          </p>
        </div>
        <div className={styles.optionCount}>
          {optionsLoading
            ? 'Loading…'
            : `${options.length} ${options.length === 1 ? 'option' : 'options'}`}
        </div>
      </div>
      {optionsLoading ? (
        <div className={styles.rewardGrid} role="status" aria-label={`Loading ${methodName} reward options`}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className={styles.rewardSkeleton} key={index} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          ))}
          <span className={styles.srOnly}>Loading verified reward options.</span>
        </div>
      ) : optionsError ? (
        <div className={styles.emptyRewards} role="alert">
          <div className={styles.emptyIcon}>
            <RefreshCw size={22} />
          </div>
          <h3>Couldn’t load reward options</h3>
          <p>{optionsError}</p>
          <button className={styles.outlineButton} onClick={retryOptions}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : options.length ? (
        <div className={styles.rewardGrid}>
          {options.map((reward) => {
            const eligibility = eligibilityQuotes[reward._id] || { loading: Boolean(token) };
            const quote = eligibility?.quote;
            const eligible = quote?.eligible === true;
            const quotedBalance = quote?.availableBalance;
            const requiredVEs = quote?.reward?.requiredVEs ?? reward.requiredVEs;
            const rewardName = quote?.reward?.displayName || reward.displayName;
            const denomination = quote?.reward?.denomination ?? reward.denomination;
            const currency = quote?.reward?.currency || reward.currency;
            const shortfall = quote?.shortfall ?? 0;
            const percent = quote
              ? Math.min(100, Math.round((quotedBalance / requiredVEs) * 100))
              : 0;
            const almostEligible = !eligible && quote && quotedBalance > 0 && percent >= 80;
            return (
              <article
                key={reward._id}
                className={`${styles.rewardCard} ${eligible ? styles.rewardEligible : ''}`}
              >
                <div className={styles.rewardTop}>
                  <span className={`${styles.rewardIcon} ${styles[selectedMethod.tone]}`}>
                    {reward.assetReference ? (
                      <img className={styles.rewardAsset} src={reward.assetReference} alt="" />
                    ) : (
                      <Icon size={19} />
                    )}
                  </span>
                  <span
                    className={`${styles.eligibility} ${eligible ? styles.good : almostEligible ? styles.almost : styles.locked}`}
                  >
                    {eligible ? (
                      <>
                        <Check size={13} /> Eligible
                      </>
                    ) : !token ? (
                      'Locked · Sign in required'
                    ) : eligibility?.loading ? (
                      'Checking…'
                    ) : eligibility?.error ? (
                      'Eligibility unavailable'
                    ) : almostEligible ? (
                      'Almost eligible'
                    ) : (
                      'Locked'
                    )}
                  </span>
                </div>
                <h4>{rewardName}</h4>
                <div className={styles.denomination}>
                  {money(denomination, currency)} <span>{currency}</span>
                </div>
                <div className={styles.costRow}>
                  <span>Required</span>
                  <strong>
                    <Coins size={15} />
                    {requiredVEs.toLocaleString('en-IN')} <small>VEs</small>
                  </strong>
                </div>
                {eligible && quote && (
                  <div className={styles.progressLabels}>
                    <span>After redemption</span>
                    <b>{quote.remainingBalance.toLocaleString('en-IN')} VEs</b>
                  </div>
                )}
                {eligibility?.error && (
                  <p className={styles.eligibilityError} role="alert">{eligibility.error}</p>
                )}
                {!eligible && quote && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressLabels}>
                      <span>{shortfall.toLocaleString('en-IN')} VEs to go</span>
                      <b>{percent}%</b>
                    </div>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}
                <button
                  className={styles.redeemButton}
                  disabled={!eligible || busy || eligibility?.loading || Boolean(eligibility?.error)}
                  onClick={() => startRedemption(reward)}
                >
                  {eligible ? (
                    <>
                      Review redemption <ArrowRight size={16} />
                    </>
                  ) : !token ? (
                    'Sign in to continue'
                  ) : eligibility?.loading ? (
                    'Checking eligibility…'
                  ) : eligibility?.error ? (
                    'Eligibility unavailable'
                  ) : (
                    'Not enough VEs'
                  )}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyRewards}>
          <div className={styles.emptyIcon}>
            <Gift size={24} />
          </div>
          <h3>Reward options coming soon</h3>
          <p>
            {activeMethod?.active !== true
              ? `${methodName} is not active yet. Verified reward options will appear here after it is enabled.`
              : `Verified options for ${methodName} haven’t been published yet. Check back later.`}
          </p>
          <button className={styles.outlineButton} onClick={retryOptions}>
            <RefreshCw size={15} /> Refresh options
          </button>
        </div>
      )}
      <div className={styles.infoStrip}>
        <ShieldCheck size={20} />
        <span>
          <b>Your balance stays protected.</b> We verify your wallet and the current reward cost on
          the server again when you confirm.
        </span>
        <button
          onClick={() =>
            setNotice(
              'Your VE balance and reward eligibility are read from the authenticated wallet and current server configuration.',
            )
          }
        >
          How it works <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
