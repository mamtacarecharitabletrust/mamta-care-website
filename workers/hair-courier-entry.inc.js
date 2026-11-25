import {courierRoute as handleHairCourier} from './hair-courier.js';
const priorHairCourierFetch=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url);
 const response=await handleHairCourier(req,env,{currentUser,carriers:mcqCarriers});
 if(response)return response;
 const original=await priorHairCourierFetch.call(this,req,env,ctx);
 if(req.method!=='GET'||!['/app/premium','/app/premium/','/app/premium/couriers'].includes(url.pathname)||!original.ok||!original.headers.get('content-type')?.includes('text/html'))return original;
 const actor=await currentUser(req,env.DB);
 if(actor?.role!=='admin')return original;
 return new HTMLRewriter().on('#mc-desk-navigation', {element(el){el.append('<a href="/app/hair-courier-reviews">Hair courier reviews</a>',{html:true});}}).transform(original);
};