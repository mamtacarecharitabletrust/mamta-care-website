/**
 * Private front/back photograph viewer for donors imported from the official
 * Google Form. This handler is intentionally not a standalone public Worker.
 * The Donor Desk router must first call its existing currentUser(req, env.DB)
 * and pass the authenticated staff object as "user".
 *
 * Mount before the existing /api/donors/:id routes:
 *   const websitePhotos = await handleWebsiteDonorPhotos(req, env, user);
 *   if (websitePhotos) return websitePhotos;
 */
const route = /^\/api\/donors\/([^/]+)\/website-photos(?:\/(front|back))?\/?$/;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
function reply(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY",
  }});
}

/**
 * Returns null when the path is unrelated; otherwise a Response.
 * This cannot replace Donor Desk login. The caller MUST supply "user"
 * exclusively from its verified server-side session reader.
 */
export async function handleWebsiteDonorPhotos(req, env, user) {
  const pathname = new URL(req.url).pathname;
  const match = route.exec(pathname);
  if (!match) return null;
  if (req.method !== "GET") return reply({ok:false,error:"Method not allowed"},405);
  if (!user?.username || !["admin","team"].includes(user.role))
    return reply({ok:false,error:"Authentication required"},401);
  if (!env.DB || !env.DONOR_PHOTOS)
    return reply({ok:false,error:"Private photograph service unavailable"},503);

  let donorId;
  try {donorId=decodeURIComponent(match[1]);}
  catch {return reply({ok:false,error:"Invalid donor reference"},400);}
  if (!donorId || donorId.length > 128 || donorId.includes("/"))
    return reply({ok:false,error:"Invalid donor reference"},400);
  const donor=await env.DB.prepare(
    "SELECT id,source,registration_id,assigned_to FROM donors WHERE id=?"
  ).bind(donorId).first();
  if (!donor) return reply({ok:false,error:"Donor not found"},404);
  if (user.role !== "admin" && donor.assigned_to !== user.username)
    return reply({ok:false,error:"Not permitted"},403);
  if (donor.source !== "google_sheet" || !donor.registration_id)
    return reply({ok:false,error:"No website photographs"},404);

  // The database view only exposes rows linked to a COMPLETE intake and
  // a Google Sheet donor with the same official registration ID.
  const rows=await env.DB.prepare(
    "SELECT side,object_key,mime,size_bytes FROM website_form_photo_link WHERE donor_id=?"
  ).bind(donorId).all();
  const photos=(rows.results||[]).filter(p =>
    ["front","back"].includes(p.side) && allowedTypes.has(p.mime)
  );
  if (!match[2]) return reply({
    ok:true,has_front:photos.some(p=>p.side==="front"),
    has_back:photos.some(p=>p.side==="back"),
  });
  const photo=photos.find(p=>p.side===match[2]);
  if (!photo) return reply({ok:false,error:"Photograph not available"},404);
  const file=await env.DONOR_PHOTOS.get(photo.object_key);
  if (!file) return reply({ok:false,error:"Photograph not available"},404);
  return new Response(file.body,{headers:{
    "Content-Type":photo.mime,
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"default-src 'none'",
    "Cross-Origin-Resource-Policy":"same-origin",
    "X-Frame-Options":"DENY",
  }});
}
