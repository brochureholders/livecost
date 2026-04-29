"use server";

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import {
  AD_SLOTS,
  buildBannerHtml,
  revalidateSlot,
  type AdSlotName,
} from "@/lib/ads";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error(
      "Server actions require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

const STORAGE_BUCKET = "ad-images";

function isAdSlot(s: string): s is AdSlotName {
  return AD_SLOTS.some((x) => x.name === s);
}

/** Upload to Supabase Storage and return the public URL.  */
async function uploadImage(file: File): Promise<string> {
  const supabase = adminClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${randomUUID()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error)
    throw new Error(`Image upload failed: ${error.message}. Did you create the "${STORAGE_BUCKET}" bucket and mark it public?`);
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

type SaveInput = {
  id?: string;
  name: string;
  slot: AdSlotName;
  enabled: boolean;
  // Quick mode
  imageUrl: string;
  clickUrl: string;
  altText: string;
  // Raw mode (overrides quick if present)
  rawHtml: string;
  // Targeting
  pageFilter: string;
  startAt: string | null;
  endAt: string | null;
  weight: number;
};

async function persist(input: SaveInput) {
  const supabase = adminClient();

  const html =
    input.rawHtml.trim().length > 0
      ? input.rawHtml
      : buildBannerHtml({
          imageUrl: input.imageUrl,
          clickUrl: input.clickUrl,
          altText: input.altText,
        });

  const row = {
    name: input.name,
    slot: input.slot,
    html,
    enabled: input.enabled,
    image_url: input.imageUrl || null,
    click_url: input.clickUrl || null,
    alt_text: input.altText || null,
    start_at: input.startAt,
    end_at: input.endAt,
    page_filter: input.pageFilter || null,
    weight: input.weight,
  };

  if (input.id) {
    const { error } = await supabase
      .from("ad_blocks")
      .update(row)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("ad_blocks").insert(row);
    if (error) throw new Error(error.message);
  }

  // Bust the slot's cache so the change reaches readers within seconds.
  revalidateSlot(input.slot);
}

function readForm(formData: FormData): Omit<SaveInput, "id"> {
  const slot = String(formData.get("slot") ?? "");
  if (!isAdSlot(slot)) {
    throw new Error(`Invalid slot: ${slot}`);
  }
  const startAt = String(formData.get("startAt") ?? "");
  const endAt = String(formData.get("endAt") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim(),
    slot,
    enabled: formData.get("enabled") === "on",
    imageUrl: String(formData.get("imageUrl") ?? "").trim(),
    clickUrl: String(formData.get("clickUrl") ?? "").trim(),
    altText: String(formData.get("altText") ?? "").trim(),
    rawHtml: String(formData.get("rawHtml") ?? "").trim(),
    pageFilter: String(formData.get("pageFilter") ?? "").trim(),
    startAt: startAt ? new Date(startAt).toISOString() : null,
    endAt: endAt ? new Date(endAt).toISOString() : null,
    weight: Number(formData.get("weight") ?? 1) || 1,
  };
}

export async function createAd(formData: FormData) {
  const input = readForm(formData);
  // Image upload (optional — also accept a raw imageUrl)
  const file = formData.get("imageFile") as File | null;
  if (file && file.size > 0) {
    input.imageUrl = await uploadImage(file);
  }
  if (!input.name) throw new Error("Name is required");
  if (!input.rawHtml && !input.imageUrl) {
    throw new Error("Provide either an image (or image URL) or raw HTML");
  }
  await persist(input);
  redirect(`/admin/ads?slot=${input.slot}`);
}

export async function updateAd(id: string, formData: FormData) {
  const input = readForm(formData);
  const file = formData.get("imageFile") as File | null;
  if (file && file.size > 0) {
    input.imageUrl = await uploadImage(file);
  }
  if (!input.name) throw new Error("Name is required");
  await persist({ ...input, id });
  redirect(`/admin/ads?slot=${input.slot}`);
}

export async function deleteAd(id: string, slot: AdSlotName) {
  const supabase = adminClient();
  const { error } = await supabase.from("ad_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSlot(slot);
  redirect(`/admin/ads?slot=${slot}`);
}

export async function toggleEnabled(
  id: string,
  slot: AdSlotName,
  enabled: boolean,
) {
  const supabase = adminClient();
  const { error } = await supabase
    .from("ad_blocks")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSlot(slot);
}
