'use client';

import { useCallback, useMemo, useState } from 'react';
import styles from './page.module.css';

const TOP_TRUST_SCORE = 8.5;
const GPS_SUCCESS_DISTANCE_METERS = 200;
const VERIFICATION_RUNNABLE_STATES = new Set(['idle', 'success', 'fail']);
const MAP_BOUNDS = {
  minLat: 21.01,
  latSpan: 0.03,
  minLng: 105.835,
  lngSpan: 0.035,
};

const mockRestaurants = [
  {
    id: 1,
    name: 'Bún Chả Hương Liên',
    cuisine: 'Vietnamese - Grill Pork Noodles',
    lat: 21.0198,
    lng: 105.8529,
    trustScore: 9.2,
    priceDeviation: false,
    priceRange: '50k - 100k',
    gpsPreset: { lat: 21.0199, lng: 105.8528 },
  },
  {
    id: 2,
    name: 'Phở Gia Truyền Bát Đàn',
    cuisine: 'Vietnamese - Beef Noodle Soup',
    lat: 21.0336,
    lng: 105.8453,
    trustScore: 8.8,
    priceDeviation: false,
    priceRange: '60k - 80k',
    gpsPreset: { lat: 21.0336, lng: 105.8453 },
  },
  {
    id: 3,
    name: 'Pizza 4P\'s Tràng Tiền',
    cuisine: 'Italian - Neapolitan Pizza',
    lat: 21.0253,
    lng: 105.8565,
    trustScore: 7.9,
    priceDeviation: true,
    priceRange: '150k - 350k',
    gpsPreset: { lat: 21.04, lng: 105.86 },
  },
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getDistanceMeters = (from, to) => {
  const earthRadiusMeters = 6371e3;
  const fromLatRadians = from.lat * Math.PI / 180;
  const toLatRadians = to.lat * Math.PI / 180;
  const deltaLatRadians = (to.lat - from.lat) * Math.PI / 180;
  const deltaLngRadians = (to.lng - from.lng) * Math.PI / 180;

  const a = Math.sin(deltaLatRadians / 2) * Math.sin(deltaLatRadians / 2) +
    Math.cos(fromLatRadians) * Math.cos(toLatRadians) *
    Math.sin(deltaLngRadians / 2) * Math.sin(deltaLngRadians / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const getMapPosition = (restaurant) => ({
  left: `${((restaurant.lng - MAP_BOUNDS.minLng) / MAP_BOUNDS.lngSpan) * 100}%`,
  top: `${(1 - (restaurant.lat - MAP_BOUNDS.minLat) / MAP_BOUNDS.latSpan) * 100}%`,
});

export default function TrustBiteHome() {
  const [selectedRest, setSelectedRest] = useState(mockRestaurants[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterTopScore, setFilterTopScore] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrLog, setOcrLog] = useState([]);
  const [userGPS, setUserGPS] = useState(mockRestaurants[0].gpsPreset);

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return mockRestaurants.filter((restaurant) => {
      const matchesSearch = !normalizedQuery ||
        restaurant.name.toLowerCase().includes(normalizedQuery) ||
        restaurant.cuisine.toLowerCase().includes(normalizedQuery);
      const matchesVerified = !filterVerified || !restaurant.priceDeviation;
      const matchesScore = !filterTopScore || restaurant.trustScore >= TOP_TRUST_SCORE;

      return matchesSearch && matchesVerified && matchesScore;
    });
  }, [filterTopScore, filterVerified, searchQuery]);

  const resetVerification = useCallback((restaurant) => {
    setSelectedRest(restaurant);
    setOcrFile(null);
    setOcrStatus('idle');
    setOcrLog([]);
    setUserGPS(restaurant.gpsPreset);
  }, []);

  const runAntiFraudVerification = useCallback(async () => {
    if (!ocrFile) return;

    const log = (msg, state) => {
      setOcrLog((previous) => [...previous, { msg, state }]);
    };

    setOcrStatus('hashing');
    setOcrLog([]);

    log('Hashing invoice image file using SHA-256...', 'active');
    await delay(1000);
    log('SHA-256 generated: 5c8f72de009e8f8... No duplicates found in DB.', 'done');

    setOcrStatus('scanning');
    log('Uploading to AWS S3 & sending to OCR Service (Textract)...', 'active');
    await delay(1500);
    log(`Text extracted successfully! Found merchant: "${selectedRest.name}"`, 'done');

    setOcrStatus('matching');
    log('Running Levenshtein string matching on Merchant Name...', 'active');
    await delay(1000);
    log('Similarity match coefficient: 94% (Threshold >= 80%). Valid merchant.', 'done');

    setOcrStatus('comparing');
    log('Validating invoice timestamp (must be within 48h limit)...', 'active');
    await delay(1000);
    log('Invoice timestamp matching constraint: Success (printed 4 hours ago).', 'done');

    setOcrStatus('gps');
    log('Requesting device coordinates for location checks...', 'active');
    await delay(1200);

    const distance = getDistanceMeters(userGPS, selectedRest);

    log(`Device Lat: ${userGPS.lat}, Lng: ${userGPS.lng}. Restaurant Lat: ${selectedRest.lat}, Lng: ${selectedRest.lng}`, 'info');
    log(`Haversine distance calculated: ${distance.toFixed(1)} meters.`, 'info');

    if (distance <= GPS_SUCCESS_DISTANCE_METERS) {
      log(`GPS match validation: Success (Distance <= ${GPS_SUCCESS_DISTANCE_METERS}m).`, 'done');
      setOcrStatus('success');
      log('Anti-fraud verification passed! Trust Score verified.', 'done');
      return;
    }

    log(`GPS verification failed: Distance exceeds ${GPS_SUCCESS_DISTANCE_METERS}m threshold.`, 'fail');
    setOcrStatus('fail');
  }, [ocrFile, selectedRest, userGPS]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleContainer}>
          <span className={styles.logo}>TrustBite<span className={styles.logoDot}>.</span></span>
          <span className={styles.slogan}>Trust in every bite</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.authBadge}>
            <span className={styles.statusDot}></span>
            Postgres Online
          </div>
          <div className={styles.authBadge}>Region: ap-southeast-1</div>
        </div>
      </header>

      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <section className={styles.searchSection}>
            <div className={styles.searchBar}>
              <input
                type="text"
                placeholder="Search restaurants, cuisines..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className={styles.filters}>
              <button
                className={`${styles.filterBtn} ${filterVerified ? styles.filterActive : ''}`}
                onClick={() => setFilterVerified((current) => !current)}
              >
                ✓ Menu Verified Only
              </button>
              <button
                className={`${styles.filterBtn} ${filterTopScore ? styles.filterActive : ''}`}
                onClick={() => setFilterTopScore((current) => !current)}
              >
                ★ Top Trust Score (&ge;{TOP_TRUST_SCORE})
              </button>
            </div>
          </section>

          <section className={styles.listSection}>
            {filteredRestaurants.length === 0 ? (
              <p className={styles.emptyText}>No restaurants found matching filter criteria.</p>
            ) : (
              filteredRestaurants.map((restaurant) => {
                const isSelected = selectedRest.id === restaurant.id;

                return (
                  <div
                    key={restaurant.id}
                    className={`${styles.restaurantCard} ${isSelected ? styles.cardActive : ''}`}
                    onClick={() => resetVerification(restaurant)}
                  >
                    <div className={styles.restaurantHeader}>
                      <div className={styles.restaurantInfo}>
                        <h4 className={styles.restaurantName}>{restaurant.name}</h4>
                        <span className={styles.restaurantCuisine}>{restaurant.cuisine}</span>
                      </div>
                      <div className={styles.trustScoreBadge}>🛡️ {restaurant.trustScore.toFixed(1)}</div>
                    </div>

                    <div className={styles.restaurantFooter}>
                      <span>{restaurant.priceRange}</span>
                      {restaurant.priceDeviation ? (
                        <span className={styles.deviationWarning}>⚠️ Price Alert (Menu Outdated)</span>
                      ) : (
                        <span className={styles.verifiedLabel}>✓ Verified Menu</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {selectedRest && (
            <div className={styles.fraudWidget}>
              <h4 className={styles.widgetTitle}>
                <span>🕵️‍♂️</span> Anti-Fraud Review Verification
              </h4>
              <p className={styles.fraudDescription}>
                Active Target: <strong>{selectedRest.name}</strong>. Provide an invoice image file to run the TrustBite automated OCR & GPS Haversine verification checks.
              </p>

              <div className={styles.formStack}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setOcrFile(event.target.files[0])}
                  className={styles.fileInput}
                />

                <div className={styles.actionRow}>
                  <button
                    className={styles.filterBtn}
                    onClick={() => setUserGPS({ lat: selectedRest.lat + 0.0005, lng: selectedRest.lng - 0.0005 })}
                  >
                    Mock Close GPS (Success)
                  </button>
                  <button
                    className={styles.filterBtn}
                    onClick={() => setUserGPS({ lat: selectedRest.lat + 0.05, lng: selectedRest.lng - 0.05 })}
                  >
                    Mock Far GPS (Fail)
                  </button>
                </div>
              </div>

              <button
                className={`${styles.filterBtn} ${styles.verifyButton} ${ocrFile ? styles.filterActive : ''}`}
                disabled={!ocrFile || !VERIFICATION_RUNNABLE_STATES.has(ocrStatus)}
                onClick={runAntiFraudVerification}
              >
                Validate Invoice OCR & GPS
              </button>

              {ocrLog.length > 0 && (
                <div className={styles.logPanel}>
                  <div className={styles.stepList}>
                    {ocrLog.map((step, index) => (
                      <div key={`${step.state}-${index}`} className={styles.stepItem}>
                        <span className={`${styles.stepIcon} ${
                          step.state === 'done' ? styles.stepDone :
                            step.state === 'active' ? styles.stepActive : styles.stepWaiting
                        }`}>
                          {step.state === 'done' ? '✓' : step.state === 'fail' ? '✗' : index + 1}
                        </span>
                        <span className={
                          step.state === 'fail' ? styles.stepMessageFail :
                            step.state === 'done' ? styles.stepMessageDone : ''
                        }>
                          {step.msg}
                        </span>
                      </div>
                    ))}
                  </div>

                  {ocrStatus === 'success' && (
                    <div className={`${styles.resultBanner} ${styles.successBanner}`}>
                      🎉 REVIEW VERIFIED (Trust Score Impact: +0.2)
                    </div>
                  )}
                  {ocrStatus === 'fail' && (
                    <div className={`${styles.resultBanner} ${styles.failBanner}`}>
                      🚨 VERIFICATION FAILED (GPS Out of Bounds)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={styles.mapContainer}>
          <div className={styles.mockMap}>
            <div className={styles.mapGrid}></div>

            {filteredRestaurants.map((restaurant) => {
              const isSelected = selectedRest.id === restaurant.id;

              return (
                <div
                  key={restaurant.id}
                  className={styles.mapPin}
                  style={getMapPosition(restaurant)}
                  onClick={() => resetVerification(restaurant)}
                >
                  <div className={`${styles.pinIcon} ${isSelected ? styles.pinIconActive : ''}`}>
                    <span className={styles.pinEmoji}>🍜</span>
                  </div>
                  <div className={`${styles.pinGlow} ${isSelected ? styles.pinGlowActive : ''}`}></div>

                  {isSelected && (
                    <div className={styles.pinPopup}>
                      <strong>{restaurant.name}</strong><br />
                      🛡️ Trust Score: {restaurant.trustScore}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
