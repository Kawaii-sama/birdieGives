-- Run this AFTER schema.sql, in the same SQL Editor.
-- Seeds the charity directory. Demo user/admin accounts are created via the
-- normal sign-up flow — see DEPLOYMENT.md, step 6.

insert into public.charities (name, description, category, icon, events, raised) values
('Swing for Life', 'Golf-funded cancer research supporting breakthrough treatments and patient care programmes across the UK.', 'Health', '💚', '["Charity Golf Day – 12 Jul 2026","Annual Gala – 5 Sep 2026"]', 142800),
('Fairway Futures', 'Empowering disadvantaged youth through sport, education, and mentorship rooted in community values.', 'Youth', '💛', '["Junior Golf Camp – 20 Aug 2026"]', 89400),
('Green Heart Foundation', 'Protecting natural landscapes and promoting environmental sustainability through conservation efforts.', 'Environment', '🌿', '["Tree Planting Day – 3 Oct 2026"]', 67200),
('Veterans on the Fairway', 'Rehabilitation and mental health support for veterans through structured sporting and social programmes.', 'Veterans', '🎖️', '["Veterans Open Day – 15 Sep 2026"]', 54100),
('Kids Can Play', 'Providing access to sport and recreation for children in underserved communities across the nation.', 'Youth', '⭐', '["Community Sports Day – 9 Aug 2026"]', 98300);
