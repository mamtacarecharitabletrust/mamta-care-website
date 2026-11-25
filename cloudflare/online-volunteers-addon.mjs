
import {onlineVolunteers} from './online-volunteers.mjs';
const beforeOnlineVolunteers=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){const path=new URL(req.url).pathname;if(path==='/volunteer-payment-qr.jpg'){if(req.method!=='GET')return new Response(null,{status:405});const obj=await env.DONOR_PHOTOS.get('site-assets/volunteer-joining-qr.jpg');return obj?new Response(obj.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=3600'}}):new Response(null,{status:503});}return await onlineVolunteers(req,env,currentUser)||beforeOnlineVolunteers.call(this,req,env,ctx)};
MC184_CATEGORIES[6].links.push(['Online volunteers','/app/premium/online-volunteers']);
MC186_META[6].actions.push(['🙋','Review online applications and match joining payments.']);
