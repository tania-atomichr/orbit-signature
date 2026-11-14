// What a portal sets when it puts the maker inside its own pages. Change it
// here, or set window.ORBIT_SIGNATURE before src/app.js loads, e.g.
//
//   <script>window.ORBIT_SIGNATURE = {
//     person: { name: "Alex Rivera", title: "Head of growth", email: "alex@northwind.com" },
//     brand: { company: "Northwind", accent: "#1f7a6d", logo: "https://cdn.northwind.com/logo.png" },
//     locked: ["company", "logo", "accent"],
//   };</script>

const DEFAULTS = {
  // Where pictures are kept so inboxes can load them; see src/storage.js.
  //  "auto": this site's own /api/images if it answers (server.mjs does),
  //          otherwise people download their pictures and host them.
  //  a URL:  POST pictures there (expects JSON { url } back).
  //  null:   never upload.
  storage: "auto",
  // Sent with each upload as X-Upload-Key, for a server that wants one.
  uploadKey: "",
  // What the form starts with: the signed-in person's details.
  person: {},  // name, title, email, linkedin, booking, website, phone
  team: {},    // name, email, booking, phone, website, linkedin
  // The company's look: company, logo and mark (public URLs; mark is the symbol
  // drawn behind the photo), accent, second, backdrop
  brand: {},
  // Fields people can't change, so every signature matches, e.g.
  // ["company", "logo", "accent", "second", "team"]
  locked: [],
  // Where vendor/ (the model and onnxruntime) is served from.
  vendor: new URL("../vendor/", import.meta.url).href,
};

const given = (typeof window !== "undefined" && window.ORBIT_SIGNATURE) || {};
export default { ...DEFAULTS, ...given };
