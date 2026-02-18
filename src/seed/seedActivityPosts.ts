import { CreatePost } from '@/services/activity/activityFeed';
import prisma from '@/libs/prisma';
import { DisasterLocation } from './seedDisasterReports';

const REQUEST_POSTS = [
  {
    description:
      'Urgently need clean drinking water for 50 families displaced by the disaster. Water supply has been contaminated and children are at risk of dehydration.',
    helpType: 'WATER' as const,
    quantity: 50,
  },
  {
    description:
      'Emergency food supplies needed for evacuation center. Over 200 people have not eaten in 24 hours. Rice, canned goods, and baby formula urgently needed.',
    helpType: 'FOOD' as const,
    quantity: 200,
  },
  {
    description:
      'Temporary shelter needed for families who lost their homes. Children and elderly need immediate cover from the elements.',
    helpType: 'SHELTER' as const,
    quantity: 30,
  },
  {
    description:
      'Need food packages and baby formula for displaced mothers and infants at the main relief camp. Medical nutrition supplements also welcome.',
    helpType: 'FOOD' as const,
    quantity: 100,
  },
  {
    description:
      'WiFi and internet access needed at evacuation center for people to contact family members and access emergency information services.',
    helpType: 'WIFI' as const,
    quantity: 5,
  },
];

const OFFER_POSTS = [
  {
    description:
      'We have 100 water bottles and 50 water purification tablets available for immediate delivery to affected areas. Contact for pickup or delivery.',
    helpType: 'WATER' as const,
    quantity: 100,
  },
  {
    description:
      'Local restaurant offering free hot meals for disaster survivors. Can serve 150 people per day. Located 2km from the evacuation zone.',
    helpType: 'FOOD' as const,
    quantity: 150,
  },
  {
    description:
      'Community hall available as temporary shelter. Can accommodate 80 people with basic facilities, running water, and first aid kit on site.',
    helpType: 'SHELTER' as const,
    quantity: 80,
  },
  {
    description:
      'Free WiFi hotspot set up near the disaster area. Powered by generator and available 24/7 for emergency communication and coordination.',
    helpType: 'WIFI' as const,
    quantity: 3,
  },
  {
    description:
      'Offering cooked meals and ready-to-eat food packs for affected families. Can deliver within 10km radius of the disaster area daily.',
    helpType: 'FOOD' as const,
    quantity: 75,
  },
];

export async function seedActivityPosts(
  systemUserId: string,
  disasterLocations: DisasterLocation[],
): Promise<void> {
  console.log('--- Seeding Activity Posts ---');

  // Idempotency: skip if system user already has posts
  const existingCount = await prisma.activityFeedPost.count({
    where: { postedById: systemUserId },
  });
  if (existingCount > 0) {
    console.log(
      `  System user already has ${existingCount} posts, skipping\n`,
    );
    return;
  }

  if (disasterLocations.length === 0) {
    console.log('  No disaster locations available, skipping activity posts\n');
    return;
  }

  let created = 0;

  // Create REQUEST posts near disaster epicenters
  for (let i = 0; i < REQUEST_POSTS.length; i++) {
    const post = REQUEST_POSTS[i];
    const location = disasterLocations[i % disasterLocations.length];
    const offsetLat = location.latitude + (Math.random() * 0.1 - 0.05);
    const offsetLng = location.longitude + (Math.random() * 0.1 - 0.05);

    try {
      await CreatePost(systemUserId, {
        activityType: 'REQUEST',
        description: post.description,
        location: {
          city: location.city,
          country: location.country,
          latitude: parseFloat(offsetLat.toFixed(6)),
          longitude: parseFloat(offsetLng.toFixed(6)),
        },
        helpItems: [{ helpType: post.helpType, quantity: post.quantity }],
      });
      created++;
      console.log(`  Created REQUEST post: ${post.helpType}`);
    } catch (error) {
      console.error(`  Failed to create REQUEST post (${post.helpType}):`, error);
    }
  }

  // Create OFFER posts from nearby cities
  for (let i = 0; i < OFFER_POSTS.length; i++) {
    const post = OFFER_POSTS[i];
    const location = disasterLocations[i % disasterLocations.length];
    const offsetLat = location.latitude + (Math.random() * 0.1 - 0.05);
    const offsetLng = location.longitude + (Math.random() * 0.1 - 0.05);

    try {
      await CreatePost(systemUserId, {
        activityType: 'OFFER',
        description: post.description,
        location: {
          city: location.city,
          country: location.country,
          latitude: parseFloat(offsetLat.toFixed(6)),
          longitude: parseFloat(offsetLng.toFixed(6)),
        },
        helpItems: [{ helpType: post.helpType, quantity: post.quantity }],
      });
      created++;
      console.log(`  Created OFFER post: ${post.helpType}`);
    } catch (error) {
      console.error(`  Failed to create OFFER post (${post.helpType}):`, error);
    }
  }

  console.log(`  Created ${created} activity posts\n`);
}
