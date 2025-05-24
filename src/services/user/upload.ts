import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

const supabase = createClient(process.env.URL!, process.env.KEY!);

export const uploadToSupabase = async (
  file: Express.Multer.File,
  userId: number,
) => {
  try {
    //optimize image
    const optimizedBuffer = await sharp(file.buffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const fileExtension = 'jpg';
    const filename = `profile-${userId}-${uuidv4()}.${fileExtension}`;
    const filePath = `profile-images/${filename}`;

    const { error } = await supabase.storage
      .from(`users`)
      .upload(filePath, optimizedBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
      // console.log(data);

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // get public URL
    const { data: urlData } = supabase.storage
      .from('users')
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      filename: filename,
    };
  } catch (error) {
    throw new Error(`Failed to upload image: ${error}`);
  }
};

export const deleteFromSupabase = async (filename: string): Promise<void> => {
  try {
    const filePath = `profile-images/${filename}`; // folder inside bucket
    
    const { error } = await supabase.storage
      .from('users') // bucket name
      .remove([filePath]);

    if (error) {
      console.error('Failed to delete old profile image:', error);
    }
  } catch (error) {
    console.error('Failed to delete old profile image:', error);
  }
};
