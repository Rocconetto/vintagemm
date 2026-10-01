import { formatDate, formatMoney } from '../lib/format';
import type { MarketBlock } from '../lib/types';

function EmptyMarket({ market }: { market: MarketBlock }) {
  const detail =
    market.status === 'not_connected'
      ? 'Live comparable listings aren’t available yet, so none are shown for this piece.'
      : market.status === 'error'
        ? 'The market source couldn’t be reached for this appraisal, so no listings are shown.'
        : market.status === 'no_query'
          ? 'The piece wasn’t identified precisely enough to search for comparable listings.'
          : `No live listings matched “${market.query}”.`;
  return (
    <div className="market-empty">
      <p className="market-empty-title">Not enough market data yet.</p>
      <p>{detail}</p>
    </div>
  );
}

export function Market({ market }: { market: MarketBlock }) {
  const hasItems = market.status === 'ok' && market.items.length > 0;

  return (
    <section className="market" aria-labelledby="market-title">
      <div className="section-head">
        <h2 id="market-title" className="section-title">
          Market intelligence
        </h2>
        {hasItems && market.summary && (
          <p className="market-summary">
            <span className="market-median">{formatMoney(market.summary.median, market.summary.currency)}</span>
            <span>
              median asking price across {market.summary.count} live {market.source === 'ebay' ? 'eBay' : market.source} listings
            </span>
          </p>
        )}
      </div>

      {hasItems ? (
        <>
          <ul className="market-rail">
            {market.items.map((item) => (
              <li key={item.url}>
                <a className={`listing${item.image ? '' : ' has-no-photo'}`} href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.image && (
                    <span className="listing-photo">
                      <img src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    </span>
                  )}
                  <span className="listing-price">{formatMoney(item.price.value, item.price.currency)}</span>
                  <span className="listing-title">{item.title ?? 'Untitled listing'}</span>
                  <span className="listing-meta">
                    {item.source}
                    {item.listedAt && formatDate(item.listedAt) ? `, listed ${formatDate(item.listedAt)}` : ''}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="fine">
            Asking prices of active listings for “{market.query}”, not completed sales. Shown for reference; they don’t change the estimate above.
          </p>
        </>
      ) : (
        <EmptyMarket market={market} />
      )}
    </section>
  );
}
