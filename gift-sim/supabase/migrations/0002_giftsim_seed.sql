-- Сгенерировано tools/build_seed.py. Не редактировать вручную.
-- Источник цен: https://fragment.com/gifts (floor = min listed price, sort=price_asc, filter=sale), дата 2026-11-01.
-- Курс: https://fragment.com/stars/buy: 1000 Stars = 12.29 TON -> 81.37 звёзд за 1 TON.

insert into giftsim.settings (key, value) values ('start_balance', '3000'), ('daily_bonus', '500') on conflict (key) do update set value = excluded.value, updated_at = now();

insert into giftsim.gifts (id, name, kind, rarity, price_stars, price_ton, supply, image_url, animation_url, source) values
  ('algorithmcup', 'Algorithm Cup', 'nft', 'mythic', 280726, 3450.0, 59, 'https://nft.fragment.com/gift/algorithmcup-1.webp', 'https://nft.fragment.com/gift/algorithmcup-1.lottie.json', 'fragment'),
  ('artisanbrick', 'Artisan Brick', 'nft', 'epic', 6916, 85.0, 3053, 'https://nft.fragment.com/gift/artisanbrick-1.webp', 'https://nft.fragment.com/gift/artisanbrick-1.lottie.json', 'fragment'),
  ('astralshard', 'Astral Shard', 'nft', 'epic', 11961, 147.0, 3002, 'https://nft.fragment.com/gift/astralshard-1.webp', 'https://nft.fragment.com/gift/astralshard-1.lottie.json', 'fragment'),
  ('bdaycandle', 'B-Day Candle', 'nft', 'common', 488, 6.0, 24942, 'https://nft.fragment.com/gift/bdaycandle-1.webp', 'https://nft.fragment.com/gift/bdaycandle-1.lottie.json', 'fragment'),
  ('berrybox', 'Berry Box', 'nft', 'rare', 814, 10.0, 9190, 'https://nft.fragment.com/gift/berrybox-1.webp', 'https://nft.fragment.com/gift/berrybox-1.lottie.json', 'fragment'),
  ('bigyear', 'Big Year', 'nft', 'common', 407, 5.0, 13048, 'https://nft.fragment.com/gift/bigyear-1.webp', 'https://nft.fragment.com/gift/bigyear-1.lottie.json', 'fragment'),
  ('blingbinky', 'Bling Binky', 'nft', 'rare', 2360, 29.0, 2196, 'https://nft.fragment.com/gift/blingbinky-1.webp', 'https://nft.fragment.com/gift/blingbinky-1.lottie.json', 'fragment'),
  ('bondedring', 'Bonded Ring', 'nft', 'rare', 3987, 49.0, 2995, 'https://nft.fragment.com/gift/bondedring-1.webp', 'https://nft.fragment.com/gift/bondedring-1.lottie.json', 'fragment'),
  ('bowtie', 'Bow Tie', 'nft', 'common', 570, 7.0, 9036, 'https://nft.fragment.com/gift/bowtie-1.webp', 'https://nft.fragment.com/gift/bowtie-1.lottie.json', 'fragment'),
  ('bunnymuffin', 'Bunny Muffin', 'nft', 'common', 732, 9.0, 6917, 'https://nft.fragment.com/gift/bunnymuffin-1.webp', 'https://nft.fragment.com/gift/bunnymuffin-1.lottie.json', 'fragment'),
  ('candycane', 'Candy Cane', 'nft', 'common', 407, 5.0, 17262, 'https://nft.fragment.com/gift/candycane-1.webp', 'https://nft.fragment.com/gift/candycane-1.lottie.json', 'fragment'),
  ('chillflame', 'Chill Flame', 'nft', 'common', 407, 5.0, 46947, 'https://nft.fragment.com/gift/chillflame-1.webp', 'https://nft.fragment.com/gift/chillflame-1.lottie.json', 'fragment'),
  ('cloverpin', 'Clover Pin', 'nft', 'common', 488, 6.0, 19755, 'https://nft.fragment.com/gift/cloverpin-1.webp', 'https://nft.fragment.com/gift/cloverpin-1.lottie.json', 'fragment'),
  ('cookieheart', 'Cookie Heart', 'nft', 'common', 488, 6.0, 13955, 'https://nft.fragment.com/gift/cookieheart-1.webp', 'https://nft.fragment.com/gift/cookieheart-1.lottie.json', 'fragment'),
  ('crystalball', 'Crystal Ball', 'nft', 'rare', 1221, 15.0, 8549, 'https://nft.fragment.com/gift/crystalball-1.webp', 'https://nft.fragment.com/gift/crystalball-1.lottie.json', 'fragment'),
  ('cupidcharm', 'Cupid Charm', 'nft', 'rare', 2197, 27.0, 6042, 'https://nft.fragment.com/gift/cupidcharm-1.webp', 'https://nft.fragment.com/gift/cupidcharm-1.lottie.json', 'fragment'),
  ('deskcalendar', 'Desk Calendar', 'nft', 'common', 570, 7.0, 34663, 'https://nft.fragment.com/gift/deskcalendar-1.webp', 'https://nft.fragment.com/gift/deskcalendar-1.lottie.json', 'fragment'),
  ('diamondring', 'Diamond Ring', 'nft', 'rare', 3011, 37.0, 8702, 'https://nft.fragment.com/gift/diamondring-1.webp', 'https://nft.fragment.com/gift/diamondring-1.lottie.json', 'fragment'),
  ('durovscap', 'Durov’s Cap', 'nft', 'legendary', 37837, 465.0, 3261, 'https://nft.fragment.com/gift/durovscap-1.webp', 'https://nft.fragment.com/gift/durovscap-1.lottie.json', 'fragment'),
  ('durovsglasses', 'Durov’s Glasses', 'nft', 'epic', 12206, 150.0, 702, 'https://nft.fragment.com/gift/durovsglasses-1.webp', 'https://nft.fragment.com/gift/durovsglasses-1.lottie.json', 'fragment'),
  ('easteregg', 'Easter Egg', 'nft', 'common', 407, 5.0, 27982, 'https://nft.fragment.com/gift/easteregg-1.webp', 'https://nft.fragment.com/gift/easteregg-1.lottie.json', 'fragment'),
  ('electricskull', 'Electric Skull', 'nft', 'rare', 2848, 35.0, 4415, 'https://nft.fragment.com/gift/electricskull-1.webp', 'https://nft.fragment.com/gift/electricskull-1.lottie.json', 'fragment'),
  ('eternalcandle', 'Eternal Candle', 'nft', 'common', 570, 7.0, 12811, 'https://nft.fragment.com/gift/eternalcandle-1.webp', 'https://nft.fragment.com/gift/eternalcandle-1.lottie.json', 'fragment'),
  ('eternalrose', 'Eternal Rose', 'nft', 'rare', 2848, 35.0, 5846, 'https://nft.fragment.com/gift/eternalrose-1.webp', 'https://nft.fragment.com/gift/eternalrose-1.lottie.json', 'fragment'),
  ('evileye', 'Evil Eye', 'nft', 'common', 732, 9.0, 18775, 'https://nft.fragment.com/gift/evileye-1.webp', 'https://nft.fragment.com/gift/evileye-1.lottie.json', 'fragment'),
  ('faithamulet', 'Faith Amulet', 'nft', 'common', 570, 7.0, 12460, 'https://nft.fragment.com/gift/faithamulet-1.webp', 'https://nft.fragment.com/gift/faithamulet-1.lottie.json', 'fragment'),
  ('finepen', 'Fine Pen', 'nft', 'common', 732, 9.0, 3675, 'https://nft.fragment.com/gift/finepen-1.webp', 'https://nft.fragment.com/gift/finepen-1.lottie.json', 'fragment'),
  ('flyingbroom', 'Flying Broom', 'nft', 'rare', 1221, 15.0, 6857, 'https://nft.fragment.com/gift/flyingbroom-1.webp', 'https://nft.fragment.com/gift/flyingbroom-1.lottie.json', 'fragment'),
  ('freshsocks', 'Fresh Socks', 'nft', 'common', 407, 5.0, 12636, 'https://nft.fragment.com/gift/freshsocks-1.webp', 'https://nft.fragment.com/gift/freshsocks-1.lottie.json', 'fragment'),
  ('gemsignet', 'Gem Signet', 'nft', 'epic', 5859, 72.0, 2190, 'https://nft.fragment.com/gift/gemsignet-1.webp', 'https://nft.fragment.com/gift/gemsignet-1.lottie.json', 'fragment'),
  ('genielamp', 'Genie Lamp', 'nft', 'rare', 3255, 40.0, 2783, 'https://nft.fragment.com/gift/genielamp-1.webp', 'https://nft.fragment.com/gift/genielamp-1.lottie.json', 'fragment'),
  ('gingercookie', 'Ginger Cookie', 'nft', 'common', 488, 6.0, 18887, 'https://nft.fragment.com/gift/gingercookie-1.webp', 'https://nft.fragment.com/gift/gingercookie-1.lottie.json', 'fragment'),
  ('hangingstar', 'Hanging Star', 'nft', 'rare', 895, 11.0, 7258, 'https://nft.fragment.com/gift/hangingstar-1.webp', 'https://nft.fragment.com/gift/hangingstar-1.lottie.json', 'fragment'),
  ('happybrownie', 'Happy Brownie', 'nft', 'common', 407, 5.0, 11985, 'https://nft.fragment.com/gift/happybrownie-1.webp', 'https://nft.fragment.com/gift/happybrownie-1.lottie.json', 'fragment'),
  ('heartlocket', 'Heart Locket', 'nft', 'legendary', 117498, 1444.0, 1331, 'https://nft.fragment.com/gift/heartlocket-1.webp', 'https://nft.fragment.com/gift/heartlocket-1.lottie.json', 'fragment'),
  ('heroichelmet', 'Heroic Helmet', 'nft', 'epic', 16193, 199.0, 1349, 'https://nft.fragment.com/gift/heroichelmet-1.webp', 'https://nft.fragment.com/gift/heroichelmet-1.lottie.json', 'fragment'),
  ('hexpot', 'Hex Pot', 'nft', 'common', 570, 7.0, 14872, 'https://nft.fragment.com/gift/hexpot-1.webp', 'https://nft.fragment.com/gift/hexpot-1.lottie.json', 'fragment'),
  ('holidaydrink', 'Holiday Drink', 'nft', 'common', 488, 6.0, 6703, 'https://nft.fragment.com/gift/holidaydrink-1.webp', 'https://nft.fragment.com/gift/holidaydrink-1.lottie.json', 'fragment'),
  ('homemadecake', 'Homemade Cake', 'nft', 'common', 488, 6.0, 33687, 'https://nft.fragment.com/gift/homemadecake-1.webp', 'https://nft.fragment.com/gift/homemadecake-1.lottie.json', 'fragment'),
  ('hypnolollipop', 'Hypno Lollipop', 'nft', 'common', 488, 6.0, 9196, 'https://nft.fragment.com/gift/hypnolollipop-1.webp', 'https://nft.fragment.com/gift/hypnolollipop-1.lottie.json', 'fragment'),
  ('icecream', 'Ice Cream', 'nft', 'common', 407, 5.0, 37243, 'https://nft.fragment.com/gift/icecream-1.webp', 'https://nft.fragment.com/gift/icecream-1.lottie.json', 'fragment'),
  ('inputkey', 'Input Key', 'nft', 'common', 651, 8.0, 15404, 'https://nft.fragment.com/gift/inputkey-1.webp', 'https://nft.fragment.com/gift/inputkey-1.lottie.json', 'fragment'),
  ('instantramen', 'Instant Ramen', 'nft', 'common', 407, 5.0, 25962, 'https://nft.fragment.com/gift/instantramen-1.webp', 'https://nft.fragment.com/gift/instantramen-1.lottie.json', 'fragment'),
  ('intelligencecup', 'Intelligence Cup', 'nft', 'mythic', 252166, 3099.0, 26, 'https://nft.fragment.com/gift/intelligencecup-2.webp', 'https://nft.fragment.com/gift/intelligencecup-2.lottie.json', 'fragment'),
  ('iongem', 'Ion Gem', 'nft', 'epic', 6916, 85.0, 2730, 'https://nft.fragment.com/gift/iongem-1.webp', 'https://nft.fragment.com/gift/iongem-1.lottie.json', 'fragment'),
  ('ionicdryer', 'Ionic Dryer', 'nft', 'rare', 1383, 17.0, 2802, 'https://nft.fragment.com/gift/ionicdryer-1.webp', 'https://nft.fragment.com/gift/ionicdryer-1.lottie.json', 'fragment'),
  ('jackinthebox', 'Jack-in-the-Box', 'nft', 'common', 488, 6.0, 16906, 'https://nft.fragment.com/gift/jackinthebox-1.webp', 'https://nft.fragment.com/gift/jackinthebox-1.lottie.json', 'fragment'),
  ('jellybunny', 'Jelly Bunny', 'nft', 'common', 732, 9.0, 14363, 'https://nft.fragment.com/gift/jellybunny-1.webp', 'https://nft.fragment.com/gift/jellybunny-1.lottie.json', 'fragment'),
  ('jesterhat', 'Jester Hat', 'nft', 'common', 407, 5.0, 13666, 'https://nft.fragment.com/gift/jesterhat-1.webp', 'https://nft.fragment.com/gift/jesterhat-1.lottie.json', 'fragment'),
  ('jinglebells', 'Jingle Bells', 'nft', 'rare', 976, 12.0, 9102, 'https://nft.fragment.com/gift/jinglebells-1.webp', 'https://nft.fragment.com/gift/jinglebells-1.lottie.json', 'fragment'),
  ('jollychimp', 'Jolly Chimp', 'nft', 'common', 651, 8.0, 15773, 'https://nft.fragment.com/gift/jollychimp-1.webp', 'https://nft.fragment.com/gift/jollychimp-1.lottie.json', 'fragment'),
  ('joyfulbundle', 'Joyful Bundle', 'nft', 'rare', 895, 11.0, 4329, 'https://nft.fragment.com/gift/joyfulbundle-1.webp', 'https://nft.fragment.com/gift/joyfulbundle-1.lottie.json', 'fragment'),
  ('khabibspapakha', 'Khabib’s Papakha', 'nft', 'rare', 2197, 27.0, 3654, 'https://nft.fragment.com/gift/khabibspapakha-1.webp', 'https://nft.fragment.com/gift/khabibspapakha-1.lottie.json', 'fragment'),
  ('kissedfrog', 'Kissed Frog', 'nft', 'epic', 5045, 62.0, 7731, 'https://nft.fragment.com/gift/kissedfrog-1.webp', 'https://nft.fragment.com/gift/kissedfrog-1.lottie.json', 'fragment'),
  ('libertyfigure', 'Liberty Figure', 'nft', 'common', 488, 6.0, 25011, 'https://nft.fragment.com/gift/libertyfigure-1.webp', 'https://nft.fragment.com/gift/libertyfigure-1.lottie.json', 'fragment'),
  ('lightsword', 'Light Sword', 'nft', 'common', 570, 7.0, 17684, 'https://nft.fragment.com/gift/lightsword-1.webp', 'https://nft.fragment.com/gift/lightsword-1.lottie.json', 'fragment'),
  ('lolpop', 'Lol Pop', 'nft', 'common', 407, 5.0, 69495, 'https://nft.fragment.com/gift/lolpop-1.webp', 'https://nft.fragment.com/gift/lolpop-1.lottie.json', 'fragment'),
  ('lootbag', 'Loot Bag', 'nft', 'epic', 12206, 150.0, 6674, 'https://nft.fragment.com/gift/lootbag-1.webp', 'https://nft.fragment.com/gift/lootbag-1.lottie.json', 'fragment'),
  ('lovecandle', 'Love Candle', 'nft', 'rare', 1058, 13.0, 3367, 'https://nft.fragment.com/gift/lovecandle-1.webp', 'https://nft.fragment.com/gift/lovecandle-1.lottie.json', 'fragment'),
  ('lovepotion', 'Love Potion', 'nft', 'rare', 1302, 16.0, 6897, 'https://nft.fragment.com/gift/lovepotion-1.webp', 'https://nft.fragment.com/gift/lovepotion-1.lottie.json', 'fragment'),
  ('lowrider', 'Low Rider', 'nft', 'epic', 5696, 70.0, 6889, 'https://nft.fragment.com/gift/lowrider-1.webp', 'https://nft.fragment.com/gift/lowrider-1.lottie.json', 'fragment'),
  ('luckylocket', 'Lucky Locket', 'nft', 'rare', 1383, 17.0, 303, 'https://nft.fragment.com/gift/luckylocket-1.webp', 'https://nft.fragment.com/gift/luckylocket-1.lottie.json', 'fragment'),
  ('lunarsnake', 'Lunar Snake', 'nft', 'common', 407, 5.0, 19971, 'https://nft.fragment.com/gift/lunarsnake-1.webp', 'https://nft.fragment.com/gift/lunarsnake-1.lottie.json', 'fragment'),
  ('lushbouquet', 'Lush Bouquet', 'nft', 'common', 570, 7.0, 6897, 'https://nft.fragment.com/gift/lushbouquet-1.webp', 'https://nft.fragment.com/gift/lushbouquet-1.lottie.json', 'fragment'),
  ('madpumpkin', 'Mad Pumpkin', 'nft', 'rare', 1709, 21.0, 6813, 'https://nft.fragment.com/gift/madpumpkin-1.webp', 'https://nft.fragment.com/gift/madpumpkin-1.lottie.json', 'fragment'),
  ('magicpotion', 'Magic Potion', 'nft', 'epic', 6103, 75.0, 3327, 'https://nft.fragment.com/gift/magicpotion-1.webp', 'https://nft.fragment.com/gift/magicpotion-1.lottie.json', 'fragment'),
  ('mightyarm', 'Mighty Arm', 'nft', 'epic', 12206, 150.0, 1853, 'https://nft.fragment.com/gift/mightyarm-1.webp', 'https://nft.fragment.com/gift/mightyarm-1.lottie.json', 'fragment'),
  ('minioscar', 'Mini Oscar', 'nft', 'epic', 8544, 105.0, 2190, 'https://nft.fragment.com/gift/minioscar-1.webp', 'https://nft.fragment.com/gift/minioscar-1.lottie.json', 'fragment'),
  ('moneypot', 'Money Pot', 'nft', 'common', 488, 6.0, 9787, 'https://nft.fragment.com/gift/moneypot-1.webp', 'https://nft.fragment.com/gift/moneypot-1.lottie.json', 'fragment'),
  ('moodpack', 'Mood Pack', 'nft', 'common', 407, 5.0, 16494, 'https://nft.fragment.com/gift/moodpack-1.webp', 'https://nft.fragment.com/gift/moodpack-1.lottie.json', 'fragment'),
  ('moonpendant', 'Moon Pendant', 'nft', 'common', 570, 7.0, 13693, 'https://nft.fragment.com/gift/moonpendant-1.webp', 'https://nft.fragment.com/gift/moonpendant-1.lottie.json', 'fragment'),
  ('moussecake', 'Mousse Cake', 'nft', 'common', 488, 6.0, 8276, 'https://nft.fragment.com/gift/moussecake-1.webp', 'https://nft.fragment.com/gift/moussecake-1.lottie.json', 'fragment'),
  ('nailbracelet', 'Nail Bracelet', 'nft', 'epic', 12124, 149.0, 1945, 'https://nft.fragment.com/gift/nailbracelet-1.webp', 'https://nft.fragment.com/gift/nailbracelet-1.lottie.json', 'fragment'),
  ('nekohelmet', 'Neko Helmet', 'nft', 'rare', 3662, 45.0, 4283, 'https://nft.fragment.com/gift/nekohelmet-1.webp', 'https://nft.fragment.com/gift/nekohelmet-1.lottie.json', 'fragment'),
  ('partysparkler', 'Party Sparkler', 'nft', 'common', 488, 6.0, 22049, 'https://nft.fragment.com/gift/partysparkler-1.webp', 'https://nft.fragment.com/gift/partysparkler-1.lottie.json', 'fragment'),
  ('perfumebottle', 'Perfume Bottle', 'nft', 'epic', 8869, 109.0, 2190, 'https://nft.fragment.com/gift/perfumebottle-1.webp', 'https://nft.fragment.com/gift/perfumebottle-1.lottie.json', 'fragment'),
  ('petsnake', 'Pet Snake', 'nft', 'common', 407, 5.0, 12126, 'https://nft.fragment.com/gift/petsnake-1.webp', 'https://nft.fragment.com/gift/petsnake-1.lottie.json', 'fragment'),
  ('plushpepe', 'Plush Pepe', 'nft', 'mythic', 569590, 7000.0, 2484, 'https://nft.fragment.com/gift/plushpepe-1.webp', 'https://nft.fragment.com/gift/plushpepe-1.lottie.json', 'fragment'),
  ('poolfloat', 'Pool Float', 'nft', 'common', 407, 5.0, 16569, 'https://nft.fragment.com/gift/poolfloat-1.webp', 'https://nft.fragment.com/gift/poolfloat-1.lottie.json', 'fragment'),
  ('preciouspeach', 'Precious Peach', 'nft', 'epic', 24004, 295.0, 2164, 'https://nft.fragment.com/gift/preciouspeach-1.webp', 'https://nft.fragment.com/gift/preciouspeach-1.lottie.json', 'fragment'),
  ('prettyposy', 'Pretty Posy', 'nft', 'common', 488, 6.0, 6074, 'https://nft.fragment.com/gift/prettyposy-1.webp', 'https://nft.fragment.com/gift/prettyposy-1.lottie.json', 'fragment'),
  ('rarebird', 'Rare Bird', 'nft', 'rare', 2441, 30.0, 3820, 'https://nft.fragment.com/gift/rarebird-1.webp', 'https://nft.fragment.com/gift/rarebird-1.lottie.json', 'fragment'),
  ('recordplayer', 'Record Player', 'nft', 'rare', 1058, 13.0, 5645, 'https://nft.fragment.com/gift/recordplayer-1.webp', 'https://nft.fragment.com/gift/recordplayer-1.lottie.json', 'fragment'),
  ('resistancedog', 'Resistance Dog', 'nft', 'legendary', 44754, 550.0, 591, 'https://nft.fragment.com/gift/resistancedog-1.webp', 'https://nft.fragment.com/gift/resistancedog-1.lottie.json', 'fragment'),
  ('restlessjar', 'Restless Jar', 'nft', 'common', 488, 6.0, 10026, 'https://nft.fragment.com/gift/restlessjar-1.webp', 'https://nft.fragment.com/gift/restlessjar-1.lottie.json', 'fragment'),
  ('sakuraflower', 'Sakura Flower', 'nft', 'rare', 976, 12.0, 14558, 'https://nft.fragment.com/gift/sakuraflower-1.webp', 'https://nft.fragment.com/gift/sakuraflower-1.lottie.json', 'fragment'),
  ('santahat', 'Santa Hat', 'nft', 'common', 570, 7.0, 12976, 'https://nft.fragment.com/gift/santahat-1.webp', 'https://nft.fragment.com/gift/santahat-1.lottie.json', 'fragment'),
  ('scaredcat', 'Scared Cat', 'nft', 'epic', 24330, 299.0, 14513, 'https://nft.fragment.com/gift/scaredcat-1.webp', 'https://nft.fragment.com/gift/scaredcat-1.lottie.json', 'fragment'),
  ('sharptongue', 'Sharp Tongue', 'nft', 'epic', 4475, 55.0, 3941, 'https://nft.fragment.com/gift/sharptongue-1.webp', 'https://nft.fragment.com/gift/sharptongue-1.lottie.json', 'fragment'),
  ('signetring', 'Signet Ring', 'nft', 'rare', 3092, 38.0, 7376, 'https://nft.fragment.com/gift/signetring-1.webp', 'https://nft.fragment.com/gift/signetring-1.lottie.json', 'fragment'),
  ('skullflower', 'Skull Flower', 'nft', 'rare', 1139, 14.0, 7147, 'https://nft.fragment.com/gift/skullflower-1.webp', 'https://nft.fragment.com/gift/skullflower-1.lottie.json', 'fragment'),
  ('skystilettos', 'Sky Stilettos', 'nft', 'rare', 1627, 20.0, 6317, 'https://nft.fragment.com/gift/skystilettos-1.webp', 'https://nft.fragment.com/gift/skystilettos-1.lottie.json', 'fragment'),
  ('sleighbell', 'Sleigh Bell', 'nft', 'rare', 1139, 14.0, 4386, 'https://nft.fragment.com/gift/sleighbell-1.webp', 'https://nft.fragment.com/gift/sleighbell-1.lottie.json', 'fragment'),
  ('snakebox', 'Snake Box', 'nft', 'common', 407, 5.0, 10566, 'https://nft.fragment.com/gift/snakebox-1.webp', 'https://nft.fragment.com/gift/snakebox-1.lottie.json', 'fragment'),
  ('snoopcigar', 'Snoop Cigar', 'nft', 'rare', 1546, 19.0, 19091, 'https://nft.fragment.com/gift/snoopcigar-1.webp', 'https://nft.fragment.com/gift/snoopcigar-1.lottie.json', 'fragment'),
  ('snoopdogg', 'Snoop Dogg', 'nft', 'common', 488, 6.0, 58036, 'https://nft.fragment.com/gift/snoopdogg-1.webp', 'https://nft.fragment.com/gift/snoopdogg-1.lottie.json', 'fragment'),
  ('snowglobe', 'Snow Globe', 'nft', 'common', 651, 8.0, 6745, 'https://nft.fragment.com/gift/snowglobe-1.webp', 'https://nft.fragment.com/gift/snowglobe-1.lottie.json', 'fragment'),
  ('snowmittens', 'Snow Mittens', 'nft', 'rare', 814, 10.0, 5194, 'https://nft.fragment.com/gift/snowmittens-1.webp', 'https://nft.fragment.com/gift/snowmittens-1.lottie.json', 'fragment'),
  ('spicedwine', 'Spiced Wine', 'nft', 'common', 488, 6.0, 12676, 'https://nft.fragment.com/gift/spicedwine-1.webp', 'https://nft.fragment.com/gift/spicedwine-1.lottie.json', 'fragment'),
  ('springbasket', 'Spring Basket', 'nft', 'common', 570, 7.0, 13817, 'https://nft.fragment.com/gift/springbasket-1.webp', 'https://nft.fragment.com/gift/springbasket-1.lottie.json', 'fragment'),
  ('spyagaric', 'Spy Agaric', 'nft', 'common', 570, 7.0, 29332, 'https://nft.fragment.com/gift/spyagaric-1.webp', 'https://nft.fragment.com/gift/spyagaric-1.lottie.json', 'fragment'),
  ('starnotepad', 'Star Notepad', 'nft', 'common', 488, 6.0, 9509, 'https://nft.fragment.com/gift/starnotepad-1.webp', 'https://nft.fragment.com/gift/starnotepad-1.lottie.json', 'fragment'),
  ('stellarrocket', 'Stellar Rocket', 'nft', 'common', 488, 6.0, 17375, 'https://nft.fragment.com/gift/stellarrocket-1.webp', 'https://nft.fragment.com/gift/stellarrocket-1.lottie.json', 'fragment'),
  ('surgeboard', 'Surge Board', 'nft', 'common', 732, 9.0, 3470, 'https://nft.fragment.com/gift/surgeboard-1.webp', 'https://nft.fragment.com/gift/surgeboard-1.lottie.json', 'fragment'),
  ('swagbag', 'Swag Bag', 'nft', 'common', 488, 6.0, 21710, 'https://nft.fragment.com/gift/swagbag-1.webp', 'https://nft.fragment.com/gift/swagbag-1.lottie.json', 'fragment'),
  ('swisswatch', 'Swiss Watch', 'nft', 'epic', 5289, 65.0, 11050, 'https://nft.fragment.com/gift/swisswatch-1.webp', 'https://nft.fragment.com/gift/swisswatch-1.lottie.json', 'fragment'),
  ('tamagadget', 'Tama Gadget', 'nft', 'common', 407, 5.0, 11588, 'https://nft.fragment.com/gift/tamagadget-1.webp', 'https://nft.fragment.com/gift/tamagadget-1.lottie.json', 'fragment'),
  ('timelessbook', 'Timeless Book', 'nft', 'common', 407, 5.0, 9644, 'https://nft.fragment.com/gift/timelessbook-1.webp', 'https://nft.fragment.com/gift/timelessbook-1.lottie.json', 'fragment'),
  ('tophat', 'Top Hat', 'nft', 'rare', 976, 12.0, 9202, 'https://nft.fragment.com/gift/tophat-1.webp', 'https://nft.fragment.com/gift/tophat-1.lottie.json', 'fragment'),
  ('toybear', 'Toy Bear', 'nft', 'rare', 3011, 37.0, 29938, 'https://nft.fragment.com/gift/toybear-1.webp', 'https://nft.fragment.com/gift/toybear-1.lottie.json', 'fragment'),
  ('trappedheart', 'Trapped Heart', 'nft', 'rare', 1465, 18.0, 9864, 'https://nft.fragment.com/gift/trappedheart-1.webp', 'https://nft.fragment.com/gift/trappedheart-1.lottie.json', 'fragment'),
  ('ufcstrike', 'UFC Strike', 'nft', 'rare', 1546, 19.0, 7012, 'https://nft.fragment.com/gift/ufcstrike-1.webp', 'https://nft.fragment.com/gift/ufcstrike-1.lottie.json', 'fragment'),
  ('valentinebox', 'Valentine Box', 'nft', 'rare', 1058, 13.0, 4075, 'https://nft.fragment.com/gift/valentinebox-1.webp', 'https://nft.fragment.com/gift/valentinebox-1.lottie.json', 'fragment'),
  ('vicecream', 'Vice Cream', 'nft', 'common', 407, 5.0, 47433, 'https://nft.fragment.com/gift/vicecream-1.webp', 'https://nft.fragment.com/gift/vicecream-1.lottie.json', 'fragment'),
  ('victorymedal', 'Victory Medal', 'nft', 'common', 488, 6.0, 16314, 'https://nft.fragment.com/gift/victorymedal-1.webp', 'https://nft.fragment.com/gift/victorymedal-1.lottie.json', 'fragment'),
  ('vintagecigar', 'Vintage Cigar', 'nft', 'rare', 3743, 46.0, 9108, 'https://nft.fragment.com/gift/vintagecigar-1.webp', 'https://nft.fragment.com/gift/vintagecigar-1.lottie.json', 'fragment'),
  ('voodoodoll', 'Voodoo Doll', 'nft', 'rare', 3499, 43.0, 11162, 'https://nft.fragment.com/gift/voodoodoll-1.webp', 'https://nft.fragment.com/gift/voodoodoll-1.lottie.json', 'fragment'),
  ('westsidesign', 'Westside Sign', 'nft', 'epic', 10415, 128.0, 5327, 'https://nft.fragment.com/gift/westsidesign-1.webp', 'https://nft.fragment.com/gift/westsidesign-1.lottie.json', 'fragment'),
  ('whipcupcake', 'Whip Cupcake', 'nft', 'common', 407, 5.0, 16048, 'https://nft.fragment.com/gift/whipcupcake-1.webp', 'https://nft.fragment.com/gift/whipcupcake-1.lottie.json', 'fragment'),
  ('winterwreath', 'Winter Wreath', 'nft', 'common', 488, 6.0, 10189, 'https://nft.fragment.com/gift/winterwreath-1.webp', 'https://nft.fragment.com/gift/winterwreath-1.lottie.json', 'fragment'),
  ('witchhat', 'Witch Hat', 'nft', 'rare', 814, 10.0, 31498, 'https://nft.fragment.com/gift/witchhat-1.webp', 'https://nft.fragment.com/gift/witchhat-1.lottie.json', 'fragment'),
  ('xmasstocking', 'Xmas Stocking', 'nft', 'common', 407, 5.0, 16597, 'https://nft.fragment.com/gift/xmasstocking-1.webp', 'https://nft.fragment.com/gift/xmasstocking-1.lottie.json', 'fragment')
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, price_stars = excluded.price_stars, price_ton = excluded.price_ton, supply = excluded.supply, image_url = excluded.image_url, animation_url = excluded.animation_url, updated_at = now();


-- Стартовый: 720 звёзд, средний выигрыш 648 (90.0%)
--   Big Year                  407 зв.  шанс 22.2038%
--   B-Day Candle              488 зв.  шанс 17.8485%
--   Bow Tie                   570 зв.  шанс 14.8066%
--   Input Key                 651 зв.  шанс 12.6194%
--   Bunny Muffin              732 зв.  шанс 10.9590%
--   Hanging Star              895 зв.  шанс 8.6047%
--   Love Candle              1058 зв.  шанс 7.0360%
--   Crystal Ball             1221 зв.  шанс 5.9219%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('starter', 'Стартовый', 720, 'crystalball', 0) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('starter', 'bigyear', 222038192), ('starter', 'bdaycandle', 178485499), ('starter', 'bowtie', 148066374), ('starter', 'inputkey', 126193677), ('starter', 'bunnymuffin', 109589799), ('starter', 'hangingstar', 86047116), ('starter', 'lovecandle', 70359902), ('starter', 'crystalball', 59219441) on conflict (case_id, gift_id) do update set weight = excluded.weight;

-- Праздничный: 1100 звёзд, средний выигрыш 990 (90.0%)
--   Big Year                  407 зв.  шанс 27.8358%
--   Bow Tie                   570 зв.  шанс 19.1282%
--   Bunny Muffin              732 зв.  шанс 14.4769%
--   Hanging Star              895 зв.  шанс 11.5725%
--   Crystal Ball             1221 зв.  шанс 8.1880%
--   Snoop Cigar              1546 зв.  шанс 6.2954%
--   Cupid Charm              2197 зв.  шанс 4.2563%
--   Rare Bird                2441 зв.  шанс 3.7852%
--   Voodoo Doll              3499 зв.  шанс 2.5346%
--   Sharp Tongue             4475 зв.  шанс 1.9271%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('festive', 'Праздничный', 1100, 'sharptongue', 1) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('festive', 'bigyear', 278358437), ('festive', 'bowtie', 191282481), ('festive', 'bunnymuffin', 144768695), ('festive', 'hangingstar', 115724521), ('festive', 'crystalball', 81880429), ('festive', 'snoopcigar', 62953671), ('festive', 'cupidcharm', 42562797), ('festive', 'rarebird', 37851827), ('festive', 'voodoodoll', 25346203), ('festive', 'sharptongue', 19270940) on conflict (case_id, gift_id) do update set weight = excluded.weight;

-- Коллекционер: 2200 звёзд, средний выигрыш 1980 (90.0%)
--   Bunny Muffin              732 зв.  шанс 33.7183%
--   Love Candle              1058 зв.  шанс 22.0909%
--   Trapped Heart            1465 зв.  шанс 15.2034%
--   Cupid Charm              2197 зв.  шанс 9.5477%
--   Electric Skull           2848 зв.  шанс 7.0878%
--   Bonded Ring              3987 зв.  шанс 4.8170%
--   Low Rider                5696 зв.  шанс 3.1983%
--   Mini Oscar               8544 зв.  шанс 2.0080%
--   Astral Shard            11961 зв.  шанс 1.3647%
--   Heroic Helmet           16193 зв.  шанс 0.9638%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('collector', 'Коллекционер', 2200, 'heroichelmet', 2) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('collector', 'bunnymuffin', 337182518), ('collector', 'lovecandle', 220909004), ('collector', 'trappedheart', 152033978), ('collector', 'cupidcharm', 95477373), ('collector', 'electricskull', 70877582), ('collector', 'bondedring', 48170170), ('collector', 'lowrider', 31983423), ('collector', 'minioscar', 20080350), ('collector', 'astralshard', 13647106), ('collector', 'heroichelmet', 9638495) on conflict (case_id, gift_id) do update set weight = excluded.weight;

-- Редкости: 8000 звёзд, средний выигрыш 7200 (90.0%)
--   Electric Skull           2848 зв.  шанс 30.5809%
--   Bonded Ring              3987 зв.  шанс 20.8144%
--   Swiss Watch              5289 зв.  шанс 15.0666%
--   Artisan Brick            6916 зв.  шанс 11.0869%
--   Westside Sign           10415 зв.  шанс 6.9418%
--   Durov’s Glasses         12206 зв.  шанс 5.7898%
--   Heroic Helmet           16193 зв.  шанс 4.1907%
--   Scared Cat              24330 зв.  шанс 2.6308%
--   Durov’s Cap             37837 зв.  шанс 1.5877%
--   Resistance Dog          44754 зв.  шанс 1.3104%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('rare', 'Редкости', 8000, 'resistancedog', 3) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('rare', 'electricskull', 305808660), ('rare', 'bondedring', 208144434), ('rare', 'swisswatch', 150666124), ('rare', 'artisanbrick', 110868753), ('rare', 'westsidesign', 69418427), ('rare', 'durovsglasses', 57898274), ('rare', 'heroichelmet', 41906944), ('rare', 'scaredcat', 26307718), ('rare', 'durovscap', 15877150), ('rare', 'resistancedog', 13103516) on conflict (case_id, gift_id) do update set weight = excluded.weight;

-- Легенды: 24000 звёзд, средний выигрыш 21600 (90.0%)
--   Mini Oscar               8544 зв.  шанс 31.6450%
--   Durov’s Glasses         12206 зв.  шанс 20.9781%
--   Heroic Helmet           16193 зв.  шанс 15.1457%
--   Precious Peach          24004 зв.  шанс 9.6219%
--   Scared Cat              24330 зв.  шанс 9.4734%
--   Durov’s Cap             37837 зв.  шанс 5.6949%
--   Resistance Dog          44754 зв.  шанс 4.6930%
--   Heart Locket           117498 зв.  шанс 1.5428%
--   Intelligence Cup       252166 зв.  шанс 0.6398%
--   Algorithm Cup          280726 зв.  шанс 0.5654%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('legends', 'Легенды', 24000, 'algorithmcup', 4) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('legends', 'minioscar', 316449630), ('legends', 'durovsglasses', 209780793), ('legends', 'heroichelmet', 151457121), ('legends', 'preciouspeach', 96218734), ('legends', 'scaredcat', 94734383), ('legends', 'durovscap', 56948743), ('legends', 'resistancedog', 46929743), ('legends', 'heartlocket', 15428177), ('legends', 'intelligencecup', 6398458), ('legends', 'algorithmcup', 5654218) on conflict (case_id, gift_id) do update set weight = excluded.weight;

-- Plush Pepe: 52000 звёзд, средний выигрыш 46800 (90.0%)
--   Precious Peach          24004 зв.  шанс 29.7200%
--   Scared Cat              24330 зв.  шанс 29.2579%
--   Durov’s Cap             37837 зв.  шанс 17.5178%
--   Resistance Dog          44754 зв.  шанс 14.4139%
--   Heart Locket           117498 зв.  шанс 4.6972%
--   Intelligence Cup       252166 зв.  шанс 1.9346%
--   Algorithm Cup          280726 зв.  шанс 1.7079%
--   Plush Pepe             569590 зв.  шанс 0.7508%
insert into giftsim.cases (id, name, price_stars, cover_gift, sort) values ('pepe', 'Plush Pepe', 52000, 'plushpepe', 5) on conflict (id) do update set name = excluded.name, price_stars = excluded.price_stars, cover_gift = excluded.cover_gift, sort = excluded.sort, active = true;
insert into giftsim.case_items (case_id, gift_id, weight) values ('pepe', 'preciouspeach', 297199620), ('pepe', 'scaredcat', 292578930), ('pepe', 'durovscap', 175177518), ('pepe', 'resistancedog', 144138625), ('pepe', 'heartlocket', 46972184), ('pepe', 'intelligencecup', 19345959), ('pepe', 'algorithmcup', 17079076), ('pepe', 'plushpepe', 7508088) on conflict (case_id, gift_id) do update set weight = excluded.weight;
