'use client';

import { useState } from 'react';
import styles from './page.module.css';

// Mock TrustBite Restaurant Database matching ERD specification
const mockRestaurants = [
  {
    id: 1,
    name: 'Bún Chả Hương Liên',
    cuisine: 'Vietnamese - Grill Pork Noodles',
    address: '24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội',
    lat: 21.0198,
    lng: 105.8529,
    trustScore: 9.2,
    verifiedReviews: 342,
    priceDeviation: false,
    priceRange: '50k - 100k',
    menuItems: [
      { name: 'Bún chả đặc biệt', price: 60000 },
      { name: 'Nem cua bể', price: 20000 }
    ]
  },
  {
    id: 2,
    name: 'Phở Gia Truyền Bát Đàn',
    cuisine: 'Vietnamese - Beef Noodle Soup',
    address: '49 Bát Đàn, Cửa Đông, Hoàn Kiếm, Hà Nội',
    lat: 21.0336,
    lng: 105.8453,
    trustScore: 8.8,
    verifiedReviews: 512,
    priceDeviation: false,
    priceRange: '60k - 80k',
    menuItems: [
      { name: 'Phở bò tái nạm', price: 65000 },
      { name: 'Phở chín', price: 60000 }
    ]
  },
  {
    id: 3,
    name: 'Pizza 4P\'s Tràng Tiền',
    cuisine: 'Italian - Neapolitan Pizza',
    address: '43 Tràng Tiền, Hoàn Kiếm, Hà Nội',
    lat: 21.0253,
    lng: 105.8565,
    trustScore: 7.9,
    verifiedReviews: 890,
    priceDeviation: true, // Menu Price alert triggered!
    priceRange: '150k - 350k',
    menuItems: [
      { name: 'Margherita Pizza', price: 165000 },
      { name: 'Burrata Parma Ham Pizza', price: 290000 }
    ]
  }
];

export default function TrustBiteHome() {
  const [selectedRest, setSelectedRest] = useState(mockRestaurants[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterScore, setFilterScore] = useState(0); // 0 = all

  // OCR/GPS Anti-Fraud Simulator states
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle'); // idle, hashing, scanning, matching, comparing, gps, success, fail
  const [ocrLog, setOcrLog] = useState([]);
  const [userGPS, setUserGPS] = useState({ lat: 21.0199, lng: 105.8528 }); // Mock coordinate close to Restaurant 1

  // Filter restaurants
  const filteredRestaurants = mockRestaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.cuisine.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVerified = filterVerified ? !r.priceDeviation : true;
    const matchesScore = r.trustScore >= filterScore;
    return matchesSearch && matchesVerified && matchesScore;
  });

  // Run Anti-Fraud verification simulation (SRS-FRAUD-001 & SRS-FRAUD-002)
  const runAntiFraudVerification = async () => {
    if (!ocrFile) return;
    setOcrStatus('hashing');
    setOcrLog([]);

    const log = (msg, state) => {
      setOcrLog(prev => [...prev, { msg, state }]);
    };

    // Step 1: Image Hashing (SHA-256 checks)
    log('Hashing invoice image file using SHA-256...', 'active');
    await new Promise(r => setTimeout(r, 1000));
    log('SHA-256 generated: 5c8f72de009e8f8... No duplicates found in DB.', 'done');
    
    // Step 2: OCR Extraction
    setOcrStatus('scanning');
    log('Uploading to AWS S3 & sending to OCR Service (Textract)...', 'active');
    await new Promise(r => setTimeout(r, 1500));
    log(`Text extracted successfully! Found merchant: "${selectedRest.name}"`, 'done');

    // Step 3: Merchant Matching (Levenshtein Distance)
    setOcrStatus('matching');
    log('Running Levenshtein string matching on Merchant Name...', 'active');
    await new Promise(r => setTimeout(r, 1000));
    log('Similarity match coefficient: 94% (Threshold >= 80%). Valid merchant.', 'done');

    // Step 4: Timestamp checks
    setOcrStatus('comparing');
    log('Validating invoice timestamp (must be within 48h limit)...', 'active');
    await new Promise(r => setTimeout(r, 1000));
    log('Invoice timestamp matching constraint: Success (printed 4 hours ago).', 'done');

    // Step 5: GPS Location checks (Haversine Formula)
    setOcrStatus('gps');
    log('Requesting device coordinates for location checks...', 'active');
    await new Promise(r => setTimeout(r, 1200));

    // Calculate simulated Haversine distance
    const R = 6371e3; // Earth radius in meters
    const phi1 = userGPS.lat * Math.PI/180;
    const phi2 = selectedRest.lat * Math.PI/180;
    const deltaPhi = (selectedRest.lat - userGPS.lat) * Math.PI/180;
    const deltaLambda = (selectedRest.lng - userGPS.lng) * Math.PI/180;
    
    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // in meters

    log(`Device Lat: ${userGPS.lat}, Lng: ${userGPS.lng}. Restaurant Lat: ${selectedRest.lat}, Lng: ${selectedRest.lng}`, 'info');
    log(`Haversine distance calculated: ${distance.toFixed(1)} meters.`, 'info');

    if (distance <= 200) {
      log('GPS match validation: Success (Distance <= 200m).', 'done');
      setOcrStatus('success');
      // Add success log
      log('Anti-fraud verification passed! Trust Score verified.', 'done');
    } else {
      log('GPS verification failed: Distance exceeds 200m threshold.', 'fail');
      setOcrStatus('fail');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleContainer}>
          <span className={styles.logo}>TrustBite<span className={styles.logoDot}>.</span></span>
          <span className={styles.slogan}>Trust in every bite</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.authBadge}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            Postgres Online
          </div>
          <div className={styles.authBadge}>
            Region: ap-southeast-1
          </div>
        </div>
      </header>

      {/* Main Split-Screen Layout */}
      <div className={styles.mainLayout}>
        
        {/* Left Column: List, Search, OCR Simulator */}
        <aside className={styles.sidebar}>
          
          {/* Search bar & filter buttons */}
          <section className={styles.searchSection}>
            <div className={styles.searchBar}>
              <input 
                type="text" 
                placeholder="Search restaurants, cuisines..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className={styles.filters}>
              <button 
                className={`${styles.filterBtn} ${filterVerified ? styles.filterActive : ''}`}
                onClick={() => setFilterVerified(!filterVerified)}
              >
                ✓ Menu Verified Only
              </button>
              <button 
                className={`${styles.filterBtn} ${filterScore === 8.5 ? styles.filterActive : ''}`}
                onClick={() => setFilterScore(filterScore === 8.5 ? 0 : 8.5)}
              >
                ★ Top Trust Score (&ge;8.5)
              </button>
            </div>
          </section>

          {/* Restaurant Scrollable Feed */}
          <section className={styles.listSection}>
            {filteredRestaurants.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
                No restaurants found matching filter criteria.
              </p>
            ) : (
              filteredRestaurants.map(r => (
                <div 
                  key={r.id} 
                  className={`${styles.restaurantCard} ${selectedRest.id === r.id ? styles.cardActive : ''}`}
                  onClick={() => {
                    setSelectedRest(r);
                    setOcrFile(null);
                    setOcrStatus('idle');
                    setOcrLog([]);
                    // Shift mock GPS coordinates slightly based on selected restaurant to simulate GPS checks
                    if (r.id === 1) setUserGPS({ lat: 21.0199, lng: 105.8528 }); // 15m away (Success)
                    if (r.id === 2) setUserGPS({ lat: 21.0336, lng: 105.8453 }); // 0m away (Success)
                    if (r.id === 3) setUserGPS({ lat: 21.0400, lng: 105.8600 }); // 1600m away (Fail)
                  }}
                  style={selectedRest.id === r.id ? { borderColor: 'var(--secondary)', boxShadow: '0 0 10px rgba(0, 242, 254, 0.15)' } : {}}
                >
                  <div className={styles.restaurantHeader}>
                    <div className={styles.restaurantInfo}>
                      <h4 className={styles.restaurantName}>{r.name}</h4>
                      <span className={styles.restaurantCuisine}>{r.cuisine}</span>
                    </div>
                    <div className={styles.trustScoreBadge}>
                      🛡️ {r.trustScore.toFixed(1)}
                    </div>
                  </div>
                  
                  <div className={styles.restaurantFooter}>
                    <span>{r.priceRange}</span>
                    {r.priceDeviation ? (
                      <span className={styles.deviationWarning}>⚠️ Price Alert (Menu Outdated)</span>
                    ) : (
                      <span className={styles.verifiedLabel}>✓ Verified Menu</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Selected Restaurant details & Anti-Fraud Simulator */}
          {selectedRest && (
            <div className={styles.fraudWidget}>
              <h4 className={styles.widgetTitle}>
                <span>🕵️‍♂️</span> Anti-Fraud Review Verification
              </h4>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Active Target: <strong>{selectedRest.name}</strong>. Provide an invoice image file to run the TrustBite automated OCR & GPS Haversine verification checks.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setOcrFile(e.target.files[0])} 
                  style={{ color: '#fff', fontSize: '0.85rem' }} 
                />
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    className={styles.filterBtn}
                    onClick={() => {
                      // Mock GPS to be closer (Success check)
                      setUserGPS({ lat: selectedRest.lat + 0.0005, lng: selectedRest.lng - 0.0005 });
                    }}
                    style={{ fontSize: '0.75rem', flex: 1 }}
                  >
                    Mock Close GPS (Success)
                  </button>
                  <button 
                    className={styles.filterBtn}
                    onClick={() => {
                      // Mock GPS to be far away (Fail check)
                      setUserGPS({ lat: selectedRest.lat + 0.05, lng: selectedRest.lng - 0.05 });
                    }}
                    style={{ fontSize: '0.75rem', flex: 1 }}
                  >
                    Mock Far GPS (Fail)
                  </button>
                </div>
              </div>

              <button 
                className={`${styles.filterBtn} ${ocrFile ? styles.filterActive : ''}`} 
                style={{ width: '100%', padding: '10px 0', border: '1px solid rgba(0, 242, 254, 0.4)' }}
                disabled={!ocrFile || ocrStatus !== 'idle' && ocrStatus !== 'success' && ocrStatus !== 'fail'}
                onClick={runAntiFraudVerification}
              >
                Validate Invoice OCR & GPS
              </button>

              {/* Steps logger */}
              {ocrLog.length > 0 && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 12, border: '1px solid var(--card-border)' }}>
                  <div className={styles.stepList}>
                    {ocrLog.map((step, idx) => (
                      <div key={idx} className={styles.stepItem}>
                        <span className={`${styles.stepIcon} ${
                          step.state === 'done' ? styles.stepDone : 
                          step.state === 'active' ? styles.stepActive : styles.stepWaiting
                        }`}>
                          {step.state === 'done' ? '✓' : step.state === 'fail' ? '✗' : idx + 1}
                        </span>
                        <span style={step.state === 'fail' ? { color: 'var(--danger)' } : step.state === 'done' ? { color: '#fff' } : {}}>
                          {step.msg}
                        </span>
                      </div>
                    ))}
                  </div>

                  {ocrStatus === 'success' && (
                    <div style={{ marginTop: 12, padding: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: 4, color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold' }}>
                      🎉 REVIEW VERIFIED (Trust Score Impact: +0.2)
                    </div>
                  )}
                  {ocrStatus === 'fail' && (
                    <div style={{ marginTop: 12, padding: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 4, color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold' }}>
                      🚨 VERIFICATION FAILED (GPS Out of Bounds)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </aside>

        {/* Right Column: Interactive Map Mock */}
        <main className={styles.mapContainer}>
          <div className={styles.mockMap}>
            <div className={styles.mapGrid}></div>
            
            {/* Render pins */}
            {filteredRestaurants.map(r => {
              // Convert lat/lng coordinates to absolute percentages relative to Hanoi box center
              // Hanoi coordinates bounds ~ lat: 21.01 to 21.04, lng: 105.83 to 105.86
              const leftPercent = ((r.lng - 105.835) / 0.035) * 100;
              const topPercent = (1 - (r.lat - 21.01) / 0.03) * 100;

              return (
                <div 
                  key={r.id}
                  className={styles.mapPin}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                  onClick={() => setSelectedRest(r)}
                >
                  <div className={`${styles.pinIcon} ${selectedRest.id === r.id ? styles.pinIconActive : ''}`}>
                    <span className={styles.pinEmoji}>🍜</span>
                  </div>
                  <div className={styles.pinGlow}></div>
                  
                  {selectedRest.id === r.id && (
                    <div className={styles.pinPopup}>
                      <strong>{r.name}</strong><br/>
                      🛡️ Trust Score: {r.trustScore}
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
