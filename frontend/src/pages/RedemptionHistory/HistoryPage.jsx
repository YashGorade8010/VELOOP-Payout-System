import { ArrowRight, History, RefreshCw } from 'lucide-react';
import stylesModule from '../../App.module.css';
import { METHODS } from '../../constants/methods.js';

export default function HistoryPage({ styles = stylesModule, rows, loading, refresh, onRedeem }) {
  return (
    <section className={styles.contentSection}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>YOUR ACTIVITY</span>
          <h2>Redemption history</h2>
          <p>Follow each request from submission through completion.</p>
        </div>
        <button className={styles.outlineButton} onClick={refresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className={styles.historySkeleton} role="status" aria-live="polite">
          <span className={styles.srOnly}>Loading redemption history.</span>
          {Array.from({ length: 4 }, (_, index) => <i key={index} aria-hidden="true" />)}
        </div>
      ) : rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>REFERENCE</th>
                <th>METHOD</th>
                <th>REWARD</th>
                <th>VE COST</th>
                <th>STATUS</th>
                <th>LATEST UPDATE</th>
                <th>SUBMITTED</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className={styles.mono}>{row.referenceId}</td>
                  <td>{METHODS[row.method]?.name || row.method}</td>
                  <td>{row.rewardSnapshot?.displayName}</td>
                  <td>{row.requiredVEs.toLocaleString('en-IN')} VE</td>
                  <td>
                    <span className={`${styles.status} ${styles[`status_${row.status}`]}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const update = row.statusHistory?.at(-1);
                      return update
                        ? `${update.status.replace('_', ' ')} · ${new Date(update.at).toLocaleString()}${update.reason ? ` — ${update.reason}` : ''}`
                        : 'No updates yet';
                    })()}
                  </td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyRewards}>
          <div className={styles.emptyIcon}>
            <History size={24} />
          </div>
          <h3>No redemptions yet</h3>
          <p>Your submitted requests will show up here with their latest status.</p>
          <button className={styles.primarySmall} onClick={onRedeem}>
            Explore rewards <ArrowRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
