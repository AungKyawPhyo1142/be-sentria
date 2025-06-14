import { TestDisasterReportJobPayload } from './goServiceTest';

export const sampleTestJobs: TestDisasterReportJobPayload[] = [
  {
    postgresReportId: 'pg_test_cuid_002',
    mongoDocId: 'mongo_test_oid_002',
    title: 'Test Case 2: Earthquake in Mandalay',
    description:
      'A strong earthquake was reported by multiple sources in Mandalay, Myanmar. Awaiting details on impact.',
    incidentType: 'EARTHQUAKE',
    severity: 'HIGH',
    incidentTimestamp: '2025-03-28T10:00:00Z',
    latitude: 21.9588,
    longitude: 96.0891,
    city: 'Mandalay',
    country: 'Myanmar',
    address: 'Central Mandalay area',
    media: [],
    reporterUserId: 102,
  },
  {
    postgresReportId: 'test_pg_001_flood_dn',
    mongoDocId: 'test_mongo_001_flood_dn',
    title: 'Flood Drill - Da Nang Riverside',
    description:
      'This is a test flood report for Da Nang to check RabbitMQ queue.',
    incidentType: 'FLOOD',
    severity: 'HIGH',
    // For GDACS to potentially find something, make timestamps very recent or match known GDACS events
    incidentTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    latitude: 16.0747, // Da Nang
    longitude: 108.2225,
    city: 'Da Nang',
    country: 'Vietnam',
    address: 'Bach Dang Street, near Han River Bridge',
    media: [
      {
        type: 'IMAGE',
        url: 'https://example.com/test/flood_dn.jpg',
        caption: 'Test flood image',
      },
    ],
    reporterUserId: 777,
  },
  {
    postgresReportId: 'test_pg_mmy_eq_01',
    mongoDocId: 'test_mongo_mmy_eq_01',
    title: 'EQ Test 1: Mandalay Region - Recent Minor',
    description:
      'Simulated minor earthquake report for Mandalay, Myanmar. Expecting GDACS corroboration for recent seismic activity.',
    incidentType: 'EARTHQUAKE',
    severity: 'LOW',
    incidentTimestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    latitude: 21.9588, // Mandalay
    longitude: 96.0891,
    city: 'Mandalay',
    country: 'Myanmar',
    address: 'Central Mandalay, near Zay Cho Market',
    media: [],
    reporterUserId: 801,
  },
  {
    postgresReportId: 'test_pg_mmy_eq_02',
    mongoDocId: 'test_mongo_mmy_eq_02',
    title: 'EQ Test 2: Mandalay - Moderate Shaking',
    description:
      'Reports of moderate shaking felt across Mandalay city. Checking GDACS.',
    incidentType: 'EARTHQUAKE',
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    latitude: 21.975, // Slightly different lat for Mandalay
    longitude: 96.0839, // Slightly different lon for Mandalay
    city: 'Mandalay',
    country: 'Myanmar',
    address: 'Amarapura Township, Mandalay',
    media: [{ type: 'IMAGE', url: 'https://example.com/mandalay_eq_test.jpg' }],
    reporterUserId: 802,
  },
  {
    postgresReportId: 'test_pg_mmy_eq_03',
    mongoDocId: 'test_mongo_mmy_eq_03',
    title: 'EQ Test 3: Sagaing (Near Mandalay) - Stronger Event',
    description:
      'Unconfirmed reports of a stronger earthquake originating near Sagaing, felt in Mandalay.',
    incidentType: 'EARTHQUAKE',
    severity: 'HIGH', // Higher severity
    incidentTimestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    latitude: 21.8889, // Sagaing (near Mandalay)
    longitude: 95.9861,
    city: 'Sagaing', // Different city, same country
    country: 'Myanmar',
    address: 'Sagaing Hill area',
    media: [],
    reporterUserId: 803,
  },
  {
    postgresReportId: 'test_pg_mmy_eq_04',
    mongoDocId: 'test_mongo_mmy_eq_04',
    title: 'EQ Test 4: Mandalay - Possible Aftershock',
    description:
      'Checking for aftershocks or related seismic activity in Mandalay via GDACS after initial reports.',
    incidentType: 'EARTHQUAKE',
    severity: 'LOW',
    incidentTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    latitude: 21.96,
    longitude: 96.09,
    city: 'Mandalay',
    country: 'Myanmar',
    address: 'Mandalay Palace vicinity',
    media: [],
    reporterUserId: 804,
  },
  {
    postgresReportId: 'test_pg_mmy_eq_05_slightly_older',
    mongoDocId: 'test_mongo_mmy_eq_05_slightly_older',
    title: 'EQ Test 5: Mandalay - Yesterday Event',
    description:
      'Checking GDACS data for an earthquake reported yesterday in Mandalay.',
    incidentType: 'EARTHQUAKE',
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago (still within +/- 24h window of your Go service search)
    latitude: 21.95,
    longitude: 96.08,
    city: 'Mandalay',
    country: 'Myanmar',
    address: 'Southern Mandalay Suburbs',
    media: [{ type: 'IMAGE', url: 'https://example.com/eq_yesterday.jpg' }],
    reporterUserId: 805,
  },

  // --- Keeping some of the other diverse test cases ---
  {
    postgresReportId: 'test_pg_003_fire_hanoi', // This was your original ID for Hanoi fire
    mongoDocId: 'test_mongo_003_fire_hanoi',
    title: 'Building Fire - Hoan Kiem District',
    description:
      'Smoke reported from a commercial building in Hoan Kiem, Hanoi.',
    incidentType: 'FIRE',
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    latitude: 21.0285, // Hanoi
    longitude: 105.8542,
    city: 'Hanoi',
    country: 'Vietnam',
    address: 'Near Hoan Kiem Lake, Hanoi',
    media: [
      {
        type: 'IMAGE',
        url: 'https://example.com/fire_hanoi.jpg',
        caption: 'Smoke from building',
      },
    ],
    reporterUserId: 701,
  },
  {
    postgresReportId: 'test_pg_004_storm_hcmc', // Original ID
    mongoDocId: 'test_mongo_004_storm_hcmc',
    title: 'Heavy Storm - Thu Duc City',
    description:
      'Intense thunderstorm with strong winds and heavy rain battering Thu Duc City, Ho Chi Minh City.',
    incidentType: 'STORM',
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    latitude: 10.8231, // Ho Chi Minh City
    longitude: 106.6297,
    city: 'Ho Chi Minh City',
    country: 'Vietnam',
    address: 'Thu Duc area, HCMC',
    media: [
      {
        type: 'VIDEO',
        url: 'https://example.com/storm_thuduc.mp4',
        caption: 'Heavy rain and wind',
      },
    ],
    reporterUserId: 702,
  },
  {
    postgresReportId: 'test_pg_005_landslide_laocai', // Original ID
    mongoDocId: 'test_mongo_005_landslide_laocai',
    title: 'Landslide Reported - Sa Pa Town',
    description:
      'A small landslide has blocked a rural road near Sa Pa, Lao Cai province.',
    incidentType: 'LANDSLIDE',
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    latitude: 22.3365, // Sa Pa
    longitude: 103.844,
    city: 'Sa Pa',
    country: 'Vietnam',
    address: 'Mountain road near Sa Pa',
    media: [],
    reporterUserId: 703,
  },
  {
    postgresReportId: 'test_pg_010_storm_phuquoc', // Original ID
    mongoDocId: 'test_mongo_010_storm_phuquoc',
    title: 'Tropical Storm Approaching - Phu Quoc Island',
    description:
      'Strong winds and high waves as a tropical storm nears Phu Quoc.',
    incidentType: 'STORM',
    severity: 'CRITICAL',
    incidentTimestamp: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 15 hours ago
    latitude: 10.2889, // Phu Quoc
    longitude: 103.9572,
    city: 'Phu Quoc',
    country: 'Vietnam',
    address: 'Coastal areas of Phu Quoc Island',
    media: [{ type: 'VIDEO', url: 'https://example.com/phuquoc_storm.mp4' }],
    reporterUserId: 708,
  },
  {
    postgresReportId: 'test_pg_015_fire_industrial_bago', // Original ID
    mongoDocId: 'test_mongo_015_fire_industrial_bago',
    title: 'Factory Fire - Bago Industrial Park',
    description:
      'Large fire at a plastics factory in Bago, Myanmar. Multiple fire units dispatched.',
    incidentType: 'FIRE',
    severity: 'CRITICAL',
    incidentTimestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    latitude: 17.3389, // Bago
    longitude: 96.4796,
    city: 'Bago',
    country: 'Myanmar',
    address: 'Bago Industrial Park',
    media: [
      { type: 'VIDEO', url: 'https://example.com/bago_factory_fire.mp4' },
    ],
    reporterUserId: 713,
  },
  // Add 9 more diverse cases to reach your target of 20+ total.
  // I'll add a few more focusing on variety.
  {
    postgresReportId: 'test_pg_023_volcano_indonesia',
    mongoDocId: 'test_mongo_023_volcano_indonesia',
    title: 'Volcanic Ash Cloud - Mount Merapi',
    description:
      'Mount Merapi, Indonesia, emitting ash cloud. Aviation warnings may be in effect.',
    incidentType: 'VOLCANO', // GDACS 'VO'
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    latitude: -7.5406, // Mount Merapi, Indonesia
    longitude: 110.446,
    city: 'Yogyakarta', // Nearby major city
    country: 'Indonesia',
    address: 'Near Mount Merapi, Central Java',
    media: [],
    reporterUserId: 806,
  },
  {
    postgresReportId: 'test_pg_024_other_poweroutage_bangkok',
    mongoDocId: 'test_mongo_024_other_poweroutage_bangkok',
    title: 'Power Outage - Sukhumvit Bangkok',
    description: 'Widespread power outage reported in Sukhumvit area, Bangkok.',
    incidentType: 'OTHER',
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    latitude: 13.7384, // Sukhumvit, Bangkok
    longitude: 100.5698,
    city: 'Bangkok',
    country: 'Thailand',
    address: 'Sukhumvit Road, Bangkok',
    media: [],
    reporterUserId: 807,
  },
  {
    postgresReportId: 'test_pg_025_storm_philippines',
    mongoDocId: 'test_mongo_025_storm_philippines',
    title: 'Typhoon Alert - Luzon',
    description:
      'Typhoon approaching Luzon, Philippines. Evacuations underway in coastal areas.',
    incidentType: 'STORM', // GDACS 'TC'
    severity: 'CRITICAL',
    incidentTimestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
    latitude: 16.776, // Approximate Luzon
    longitude: 121.0,
    city: 'Manila',
    country: 'Philippines',
    address: 'Luzon Island, Philippines',
    media: [{ type: 'VIDEO', url: 'https://example.com/ph_typhoon.mp4' }],
    reporterUserId: 808,
  },
  {
    postgresReportId: 'test_pg_026_fire_usa_california',
    mongoDocId: 'test_mongo_026_fire_usa_california',
    title: 'Wildfire Spreading - California Hills',
    description:
      'A wildfire is rapidly spreading in the hills near a residential area in California.',
    incidentType: 'FIRE', // GDACS 'WF'
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    latitude: 34.0522, // Los Angeles area
    longitude: -118.2437,
    city: 'Los Angeles',
    country: 'USA', // Or "United States" - check what GDACS uses
    address: 'Foothills, CA',
    media: [],
    reporterUserId: 809,
  },
  {
    postgresReportId: 'test_pg_027_flood_bangladesh',
    mongoDocId: 'test_mongo_027_flood_bangladesh',
    title: 'Monsoon Flooding - Bangladesh Delta',
    description:
      'Heavy monsoon rains causing widespread flooding in coastal districts of Bangladesh.',
    incidentType: 'FLOOD', // GDACS 'FL'
    severity: 'CRITICAL',
    incidentTimestamp: new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString(), // 2 days ago
    latitude: 22.9, // Coastal Bangladesh area
    longitude: 90.85,
    city: 'Barisal',
    country: 'Bangladesh',
    address: 'Delta region, Bangladesh',
    media: [{ type: 'IMAGE', url: 'https://example.com/bd_flood.jpg' }],
    reporterUserId: 810,
  },
  // Last 5 new ones, making sure we have variety and hit the 20+ mark.
  {
    postgresReportId: 'test_pg_028_eq_japan_recent',
    mongoDocId: 'test_mongo_028_eq_japan_recent',
    title: 'EQ Japan - Recent Check',
    description: 'Recent earthquake check for Japan, good for GDACS data.',
    incidentType: 'EARTHQUAKE',
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    latitude: 35.6804, // Tokyo
    longitude: 139.769,
    city: 'Tokyo',
    country: 'Japan',
    address: 'Central Tokyo',
    media: [],
    reporterUserId: 811,
  },
  {
    postgresReportId: 'test_pg_029_other_haze_indonesia',
    mongoDocId: 'test_mongo_029_other_haze_indonesia',
    title: 'Transboundary Haze Event',
    description:
      'Significant haze affecting Sumatra, Indonesia, and neighboring regions. Likely due to forest fires.',
    incidentType: 'OTHER', // Could be linked to FIRE (WF in GDACS) but reported as general haze
    severity: 'HIGH',
    incidentTimestamp: new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000,
    ).toISOString(), // 1 day ago
    latitude: -0.5897, // Sumatra
    longitude: 101.3431,
    city: 'Pekanbaru',
    country: 'Indonesia',
    address: 'Riau Province, Sumatra',
    media: [],
    reporterUserId: 812,
  },
  {
    postgresReportId: 'test_pg_030_storm_uk_coast',
    mongoDocId: 'test_mongo_030_storm_uk_coast',
    title: 'Coastal Storm - UK South Coast',
    description:
      'Strong gales and high tides causing coastal flooding alerts on the UK south coast.',
    incidentType: 'STORM', // GDACS might use TC for very strong ones, or have other classifications
    severity: 'MEDIUM',
    incidentTimestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
    latitude: 50.8225, // Brighton, UK
    longitude: -0.1372,
    city: 'Brighton',
    country: 'United Kingdom', // GDACS uses "UNITED KINGDOM"
    address: 'South Coast, UK',
    media: [],
    reporterUserId: 813,
  },
  {
    postgresReportId: 'test_pg_031_landslide_nepal',
    mongoDocId: 'test_mongo_031_landslide_nepal',
    title: 'Landslide after Monsoon - Nepal Hills',
    description:
      'Monsoon rains trigger landslide in a hilly region of Nepal, cutting off a village.',
    incidentType: 'LANDSLIDE',
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
    latitude: 27.7172, // Kathmandu (general area)
    longitude: 85.324,
    city: 'Kathmandu Valley',
    country: 'Nepal',
    address: 'Remote hilly region',
    media: [{ type: 'IMAGE', url: 'https://example.com/nepal_landslide.jpg' }],
    reporterUserId: 814,
  },
  {
    postgresReportId: 'test_pg_032_fire_australia_bush',
    mongoDocId: 'test_mongo_032_fire_australia_bush',
    title: 'Bushfire Warning - NSW',
    description:
      'Bushfire warning issued for several areas in New South Wales, Australia, due to hot and windy conditions.',
    incidentType: 'FIRE', // GDACS 'WF'
    severity: 'HIGH',
    incidentTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    latitude: -33.8688, // Sydney (general area for NSW)
    longitude: 151.2093,
    city: 'Sydney',
    country: 'Australia',
    address: 'Rural NSW',
    media: [],
    reporterUserId: 815,
  },
];
