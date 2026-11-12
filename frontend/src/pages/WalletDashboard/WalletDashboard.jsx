import {
  ArrowDownRight,
  ArrowRight,
  Clock3,
  CreditCard,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import styles from './WalletDashboard.module.css';
import { METHODS, getMethodDisplayName } from '../../constants/methods.js';

function formatCurrency(value, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default function WalletDashboard({
  identity,
  balance,
  totalWithdrawn,
  methods,
  options,
  rows,
  tab,
  setTab,
  historyLoading,
  balanceLoading,
  refresh,
  onWithdraw,
}) {
  const recentRows = rows.slice(0, 6);

  return (
    <div className={styles.dashboard}>
      <section className={styles.welcome}>
        <div>
          <span className={styles.kicker}>YOUR VELOOP WALLET</span>
          <h1>Welcome{identity?.name ? `, ${identity.name.split(' ')[0]}` : ' back'}</h1>
          <p>Track your rewards, payment methods and withdrawal activity in one place.</p>
        </div>
        <button
          className={styles.refreshButton}
          onClick={refresh}
          disabled={balanceLoading || historyLoading}
        >
          <RefreshCw
            size={16}
            className={balanceLoading || historyLoading ? styles.spinning : ''}
          />
          Refresh
        </button>
      </section>

      <section className={styles.stats} aria-label="Wallet summary">
        <article className={styles.balanceStat}>
          <span className={styles.statIcon}>
            <Wallet size={20} />
          </span>
          <span className={styles.statLabel}>AVAILABLE VEs</span>
          {balanceLoading ? (
            <span className={styles.statSkeleton} aria-label="Loading available VE balance" />
          ) : (
            <strong>
              {balance === null
                ? '—'
                : `${balance.toLocaleString('en-IN')} VEs`}
            </strong>
          )}
          <small>Ready to use for rewards</small>
        </article>
        <article>
          <span className={styles.statIcon}>
            <ArrowDownRight size={20} />
          </span>
          <span className={styles.statLabel}>ESTIMATED BALANCE</span>
          <strong>—</strong>
          <small>₹ conversion rate not configured</small>
        </article>
        <article>
          <span className={styles.statIcon}>
            <CreditCard size={20} />
          </span>
          <span className={styles.statLabel}>TOTAL WITHDRAWN</span>
          <strong>{totalWithdrawn === null ? '—' : formatCurrency(totalWithdrawn)}</strong>
          <small>Completed INR redemptions</small>
        </article>
        <article>
          <span className={styles.statIcon}>
            <ShieldCheck size={20} />
          </span>
          <span className={styles.statLabel}>CURRENT RANK / LEVEL</span>
          <strong>Not assigned</strong>
          <small>No rank is configured for this account</small>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.tabs} role="tablist" aria-label="Wallet details">
          <button
            role="tab"
            aria-selected={tab === 'methods'}
            className={tab === 'methods' ? styles.activeTab : ''}
            onClick={() => setTab('methods')}
          >
            <CreditCard size={16} /> Payment Methods
          </button>
          <button
            role="tab"
            aria-selected={tab === 'transactions'}
            className={tab === 'transactions' ? styles.activeTab : ''}
            onClick={() => setTab('transactions')}
          >
            <Clock3 size={16} /> Transactions History
          </button>
        </div>

        {tab === 'methods' ? (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Withdrawal methods</h2>
                <p>Choose a configured method to review its available rewards.</p>
              </div>
              <span className={styles.count}>{methods.length} configured</span>
            </div>
            {methods.length ? (
              <div className={styles.methodList}>
                {methods.map((method) => {
                  const descriptor = METHODS[method.methodKey];
                  const Icon = descriptor?.icon || CreditCard;
                  const methodOptions = options.filter(
                    (option) => option.method === method.methodKey && option.active,
                  );
                  return (
                    <article className={styles.methodCard} key={method._id || method.methodKey}>
                      <span
                        className={`${styles.methodIcon} ${styles[descriptor?.tone || 'violet']}`}
                      >
                        <Icon size={20} />
                      </span>
                      <div className={styles.methodCopy}>
                        <h3>{getMethodDisplayName(method.methodKey, method.displayName)}</h3>
                        <p>
                          {method.description ||
                            descriptor?.caption ||
                            'Redeem VEs with this payment method.'}
                        </p>
                        <small>
                          {method.active
                            ? `${methodOptions.length} active reward option${methodOptions.length === 1 ? '' : 's'}`
                            : method.maintenanceMessage || 'Currently unavailable'}
                        </small>
                      </div>
                      <span
                        className={`${styles.availability} ${method.active ? styles.available : styles.unavailable}`}
                      >
                        <i />
                        {method.active ? 'Available' : 'Unavailable'}
                      </span>
                      <button
                        className={styles.useButton}
                        disabled={!method.active}
                        onClick={() => onWithdraw(method.methodKey)}
                      >
                        {method.active ? (
                          <>
                            Withdraw <ArrowRight size={15} />
                          </>
                        ) : (
                          'Unavailable'
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>Payment methods have not been configured yet.</div>
            )}
          </div>
        ) : (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Transactions history</h2>
                <p>Your withdrawal requests and their latest status.</p>
              </div>
              <span className={styles.count}>Latest {rows.length}</span>
            </div>
            {historyLoading ? (
              <div className={styles.emptyState}>
                <span className={styles.loader} /> Loading transactions…
              </div>
            ) : recentRows.length ? (
              <div className={styles.transactionList}>
                {recentRows.map((row) => (
                  <article className={styles.transaction} key={row._id || row.referenceId}>
                    <span className={styles.transactionIcon}>
                      <ArrowDownRight size={18} />
                    </span>
                    <div className={styles.transactionInfo}>
                      <strong>
                        {row.rewardSnapshot?.displayName || getMethodDisplayName(row.method, '')}
                      </strong>
                      <small>
                        {row.referenceId} · {new Date(row.createdAt).toLocaleDateString('en-IN')}
                      </small>
                    </div>
                    <div className={styles.transactionValue}>
                      <strong>
                        {row.rewardSnapshot?.denomination != null
                          ? formatCurrency(
                              row.rewardSnapshot.denomination,
                              row.rewardSnapshot.currency || 'INR',
                            )
                          : '—'}
                      </strong>
                      <span className={`${styles.status} ${styles[`status${row.status}`] || ''}`}>
                        {row.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No transactions yet. Completed and pending redemptions will appear here.
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.information}>
        <article>
          <span>
            <Clock3 size={18} />
          </span>
          <div>
            <h3>Withdrawal processing</h3>
            <p>
              Every request is verified and tracked. You can follow its current status in
              Transactions History.
            </p>
          </div>
        </article>
        <article>
          <span>
            <LockKeyhole size={18} />
          </span>
          <div>
            <h3>Payment security</h3>
            <p>
              Your payment destination is submitted securely and is not shown in transaction
              history.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
