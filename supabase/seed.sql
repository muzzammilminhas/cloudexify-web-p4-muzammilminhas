-- Fictional PKR menu for Aatish & Aangan.
insert into public.menu_items
  (name, description, price, category, image_url, image_position, badge, spice_level, dietary, available, featured)
values
  ('Saffron Chicken Tikka', 'Yoghurt-marinated chicken, saffron smoke, charred lemon and garden mint.', 1290, 'From the Angaar', 'assets/menu-atlas.webp', 'top-left', 'Chef''s fire', 2, 'Gluten aware', true, true),
  ('Potohari Chapli Kebab', 'Hand-pressed beef kebab with crushed coriander, pomegranate and pickled onion.', 1390, 'From the Angaar', 'assets/menu-atlas.webp', 'top-right', 'Potohar favourite', 2, null, true, true),
  ('Smoked Lamb Chops', 'Three coal-seared lamb chops with black cardamom jus and roasted garlic.', 2890, 'From the Angaar', 'assets/hero.webp', 'center', 'Limited nightly', 2, 'Gluten aware', true, true),
  ('Charred Paneer Tikka', 'House paneer, sweet pepper, kasuri methi and ember-roasted tomato.', 990, 'From the Angaar', 'assets/menu-atlas.webp', 'top-left', null, 1, 'Vegetarian', true, false),
  ('Aangan Lamb Karahi', 'Slow-fired lamb, tomatoes, green chilli and cracked black pepper in a copper handi.', 2590, 'Potohar Plates', 'assets/hero.webp', 'center', 'Signature', 3, 'Gluten aware', true, true),
  ('Kashmiri Murg Yakhni', 'Tender chicken in a silken yoghurt broth scented with fennel and dried mint.', 1590, 'Potohar Plates', 'assets/menu-atlas.webp', 'bottom-left', null, 1, 'Gluten aware', true, false),
  ('Coal-Smoked Daal Makhni', 'Black lentils rested overnight, finished with cultured butter and ember smoke.', 790, 'Potohar Plates', 'assets/menu-atlas.webp', 'bottom-right', 'Slow cooked', 1, 'Vegetarian', true, false),
  ('Sarson Saag & Makai Crisp', 'Mustard greens, white butter and crisp corn flatbread shards.', 890, 'Potohar Plates', 'assets/menu-atlas.webp', 'top-left', 'Seasonal', 1, 'Vegetarian', true, false),
  ('Badami Yakhni Pulao', 'Fragrant rice, tender chicken, yakhni stock, toasted almond and caramelised onion.', 1390, 'Rice & Dum', 'assets/menu-atlas.webp', 'bottom-left', 'House comfort', 1, null, true, true),
  ('Smoked Sindhi Biryani', 'Sella rice, slow-cooked chicken, plum, mint and a bright chilli finish.', 1490, 'Rice & Dum', 'assets/menu-atlas.webp', 'bottom-left', null, 3, null, true, false),
  ('Saffron Zarda Rice', 'Sweet basmati, orange peel, pistachio and candied fennel.', 690, 'Rice & Dum', 'assets/menu-atlas.webp', 'bottom-right', null, 0, 'Vegetarian', true, false),
  ('Pomegranate Kachumber', 'Cucumber, tomato, pomegranate, red onion and roasted cumin dressing.', 490, 'Garden & Grain', 'assets/menu-atlas.webp', 'top-right', 'Fresh', 1, 'Vegan', true, false),
  ('Smoked Aubergine Chaat', 'Coal-roasted aubergine, tamarind, yoghurt, chickpea crisp and herbs.', 690, 'Garden & Grain', 'assets/hero.webp', 'center', null, 2, 'Vegetarian', true, false),
  ('Saffron Kheer', 'Slow-set rice pudding with saffron, pistachio and dried rose.', 590, 'Meetha', 'assets/menu-atlas.webp', 'bottom-right', 'Aangan classic', 0, 'Vegetarian', true, true),
  ('Gurh Crème Brûlée', 'A jaggery custard with a glassy caramel top and sea salt.', 690, 'Meetha', 'assets/menu-atlas.webp', 'bottom-right', null, 0, 'Vegetarian', true, false),
  ('Salt Range Kahwa', 'Green tea, cinnamon, cardamom, almond and a thread of saffron.', 390, 'House Pour', 'assets/menu-atlas.webp', 'bottom-right', null, 0, 'Vegan', true, false),
  ('Kinnow & Black Salt Soda', 'Wah kinnow, soda, black salt and toasted coriander seed.', 450, 'House Pour', 'assets/menu-atlas.webp', 'top-left', 'Zero-proof', 0, 'Vegan', true, false)
on conflict (name) do update set
  description = excluded.description,
  price = excluded.price,
  category = excluded.category,
  image_url = excluded.image_url,
  image_position = excluded.image_position,
  badge = excluded.badge,
  spice_level = excluded.spice_level,
  dietary = excluded.dietary,
  available = excluded.available,
  featured = excluded.featured;

