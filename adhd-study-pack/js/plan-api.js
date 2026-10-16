/* Where the AI planner lives. On Lovable hosts it is same-origin; on the live
   site it calls the published Lovable app. Set PUBLISHED once it is published. */
(function () {
  var PUBLISHED = 'https://adhd-study-pack.lovable.app';
  var h = location.hostname;
  var local = /\.lovable\.app$/.test(h) || h === 'localhost' || h === '127.0.0.1';
  window.StudyPlanApi = {
    url: function () { return (local ? '' : PUBLISHED) + '/api/public/plan'; },
    request: async function (body) {
      var r = await fetch(this.url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok || !data.plan) throw new Error(data.error || 'Could not create a plan.');
      return data.plan;
    }
  };
})();
