import { http } from "@/shared/api/http";

export interface Media {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  kind: "photo" | "logo" | "document";
  width: number | null;
  height: number | null;
  bytes: number;
}

/**
 * Uploads, as the listing form uses them.
 *
 * A photo is uploaded the moment it is chosen and the form holds the resulting
 * id. That is what makes a five-photo upload survivable on a phone: each lands
 * independently, a failure names the photo it failed on, and Save sends ids
 * rather than fifteen megabytes of JPEG.
 */
export const mediaApi = {
  async upload(file: File, kind: Media["kind"] = "photo") {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const res = await http.post<{ data: Media }>("/media", form);
    return res.data.data;
  },

  async remove(id: string) {
    await http.delete(`/media/${id}`);
  },
};
