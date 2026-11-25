
const beforeVolunteerPaymentSchedule=launch_wig_maker_portal_worker_default.scheduled;
launch_wig_maker_portal_worker_default.scheduled=function(event,env,ctx){if(phonePeEnabled(env))ctx.waitUntil(reconcile(env));return beforeVolunteerPaymentSchedule.call(this,event,env,ctx)};
