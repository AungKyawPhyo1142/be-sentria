import prisma from '@/libs/prisma';
import { createResource } from '@/services/resources/resources';
import { User } from '@prisma/client';

interface ResourceSeedEntry {
  name: string;
  description: string;
  resourceType: 'SURVIVAL' | 'HOTLINE' | 'FIRST_AID';
  coordinates: [number, number]; // [lng, lat]
  address: {
    city: string;
    country: string;
    fullAddress?: string;
  };
}

const SEED_RESOURCES: ResourceSeedEntry[] = [
  // --- HOTLINE entries ---
  {
    name: 'Myanmar Emergency Hotline (191)',
    description:
      'Myanmar National Emergency Hotline. Call 191 for police, fire, and medical emergencies across Myanmar. Available 24/7 in Burmese and English.',
    resourceType: 'HOTLINE',
    coordinates: [96.1561, 16.8661], // Yangon
    address: {
      city: 'Yangon',
      country: 'Myanmar',
      fullAddress: 'Myanmar National Emergency Services',
    },
  },
  {
    name: 'Philippines Emergency Hotline (911)',
    description:
      'Philippines National Emergency Hotline. Dial 911 for police, fire, medical, and disaster response. Operates 24/7 nationwide in Filipino and English.',
    resourceType: 'HOTLINE',
    coordinates: [120.9842, 14.5995], // Manila
    address: {
      city: 'Manila',
      country: 'Philippines',
      fullAddress: 'Philippine National Police / Bureau of Fire Protection',
    },
  },
  {
    name: 'Indonesia Emergency Hotline (117)',
    description:
      'Indonesia Search and Rescue Emergency Number. Call 117 for natural disaster rescue operations, missing persons, and emergency evacuations.',
    resourceType: 'HOTLINE',
    coordinates: [106.845, -6.2088], // Jakarta
    address: {
      city: 'Jakarta',
      country: 'Indonesia',
      fullAddress: 'BASARNAS - Badan Nasional Pencarian dan Pertolongan',
    },
  },
  {
    name: 'Japan Emergency Hotline (110 / 119)',
    description:
      'Japan Emergency Services. Call 110 for police emergencies and 119 for fire and ambulance. English support available in major cities through translation services.',
    resourceType: 'HOTLINE',
    coordinates: [139.6917, 35.6895], // Tokyo
    address: {
      city: 'Tokyo',
      country: 'Japan',
      fullAddress: 'National Police Agency / Fire and Disaster Management Agency',
    },
  },

  // --- SURVIVAL guides ---
  {
    name: 'Earthquake Safety: Drop, Cover, Hold On',
    description:
      'During an earthquake: DROP to the ground, take COVER under a sturdy desk or table, and HOLD ON until the shaking stops. Stay away from windows, heavy furniture, and exterior walls. If outdoors, move to an open area away from buildings. After shaking stops, check for injuries and be prepared for aftershocks. Do not use elevators.',
    resourceType: 'SURVIVAL',
    coordinates: [0, 0],
    address: { city: 'Global', country: 'Global' },
  },
  {
    name: 'Flood Evacuation Procedures',
    description:
      'If flooding is imminent: move immediately to higher ground. Do not walk, swim, or drive through flood waters - just 6 inches of moving water can knock you down. Disconnect electrical appliances. Avoid contact with floodwater as it may be contaminated. If trapped in a building, go to the highest level but do not climb into a closed attic. Signal for help from a window or rooftop.',
    resourceType: 'SURVIVAL',
    coordinates: [0, 0],
    address: { city: 'Global', country: 'Global' },
  },
  {
    name: 'Emergency Water Purification Methods',
    description:
      'When clean water is unavailable: Boiling is the safest method - bring water to a rolling boil for 1 minute (3 minutes above 6,500 feet elevation). Chemical disinfection: add 2 drops of unscented household bleach per liter of water, stir and let stand 30 minutes. Solar disinfection (SODIS): fill clear PET bottles and place in direct sunlight for 6+ hours. Always filter cloudy water through cloth first.',
    resourceType: 'SURVIVAL',
    coordinates: [0, 0],
    address: { city: 'Global', country: 'Global' },
  },

  // --- FIRST_AID entries ---
  {
    name: 'First Aid: Crush Injuries and Trapped Victims',
    description:
      'For crush injuries after building collapse: Do NOT immediately remove heavy objects from limbs trapped for more than 1 hour - this can cause crush syndrome. Call emergency services first. Keep the victim calm and warm. If the limb is accessible, apply a tourniquet BEFORE releasing the crushing weight. Monitor for signs of shock: pale skin, rapid pulse, confusion. Provide water if conscious and not vomiting.',
    resourceType: 'FIRST_AID',
    coordinates: [0, 0],
    address: { city: 'Global', country: 'Global' },
  },
  {
    name: 'First Aid: Burns and Smoke Inhalation',
    description:
      'For burns: Cool the burn immediately with cool (not cold) running water for at least 20 minutes. Do NOT apply ice, butter, or toothpaste. Cover with a clean, non-stick dressing. For smoke inhalation: move victim to fresh air immediately. If not breathing, begin CPR. Watch for delayed symptoms: coughing, hoarseness, or difficulty breathing may develop hours later. Seek medical attention for all burns larger than the palm.',
    resourceType: 'FIRST_AID',
    coordinates: [0, 0],
    address: { city: 'Global', country: 'Global' },
  },
];

async function resourceExists(name: string): Promise<boolean> {
  const existing = await prisma.resource.findFirst({ where: { name } });
  return existing !== null;
}

export async function seedResources(systemUser: User): Promise<void> {
  console.log('--- Seeding Resources ---');
  let created = 0;

  for (const entry of SEED_RESOURCES) {
    if (await resourceExists(entry.name)) {
      console.log(`  Skipping "${entry.name}" - already exists`);
      continue;
    }

    // Build the payload matching ValidatedResourcePayload shape
    const payload = {
      description: entry.description,
      resourceType: entry.resourceType,
      location: {
        type: 'Point' as const,
        coordinates: entry.coordinates,
      },
      address: entry.address,
    };

    try {
      await createResource(payload as any, entry.name, systemUser);
      created++;
      console.log(`  Created ${entry.resourceType}: "${entry.name}"`);
    } catch (error) {
      console.error(`  Failed to create resource "${entry.name}":`, error);
    }
  }

  console.log(`  Created ${created} resources\n`);
}
