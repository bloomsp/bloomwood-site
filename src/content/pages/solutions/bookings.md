---
title: "Bookings"
description: "Book onsite support, remote support, or a free 15‑minute quick chat with Bloomwood Solutions."
---

# Book a service

Choose the option that best fits what you need. If you’re unsure, start with the free quick chat.

<div class="bw-cal-buttons" style="display:flex; flex-wrap:wrap; gap:0.75rem; margin:1rem 0 1.5rem;">
  <button data-cal-link="bloomwood/onsite" style="padding:.75rem 1rem; border:1px solid currentColor; border-radius:.5rem;">Book onsite service</button>
  <button data-cal-link="bloomwood/remote-support" style="padding:.75rem 1rem; border:1px solid currentColor; border-radius:.5rem;">Book remote support</button>
  <button data-cal-link="bloomwood/quick-chat" style="padding:.75rem 1rem; border:1px solid currentColor; border-radius:.5rem;">Book a free 15‑minute quick chat</button>
</div>

<!-- cal.com embed -->
<script>
  (function (C, A, L) {
    let p = function (a, ar) {
      a.q.push(ar);
    };
    let d = C.document;
    C.Cal = C.Cal || function () {
      let cal = C.Cal;
      let ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        let s = d.createElement("script");
        s.src = A;
        d.head.appendChild(s);
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () {
          p(api, arguments);
        };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", { origin: "https://cal.com" });
</script>

## Rates and service types

- **Onsite IT service:** **$120/hour**
- **Remote support:** **$80/hour** (all remote bookings require **$40 pre‑payment** at time of booking; credited to your time)
- **Flat pack furniture assembly:** **$40/hour** (please allow **~1 hour** per flat pack)

More details:

- [Services](/solutions/bookings/services/)
- [Service area](/solutions/bookings/service-area/)
- [Pricing](/solutions/bookings/pricing/)
- [Terms & Conditions](/solutions/bookings/terms-conditions/)

## Save money with a pre‑paid service pack

If you expect to need help more than once, a pre‑paid pack can save money.

- [Pre‑paid service packs](/solutions/bookings/pre-paid-service-packs/)

## Questions?

- WhatsApp: [Chat via WhatsApp](https://wa.me/61492991759)
- Or use the contact page: [Contact us](/solutions/contact-us/)
