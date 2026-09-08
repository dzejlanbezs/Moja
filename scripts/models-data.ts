export type SeedModel = {
  name: string;
  age: number;
  city: string;
  country: string;
  tagline: string;
  bio: string;
  price: number;
  heightCm: number;
  languages: string[];
  interests: string[];
  zodiac: string;
  hair: string;
  eyes: string;
};

export const SEED_MODELS: SeedModel[] = [
  {
    name: "Sofia Marchetti", age: 24, city: "Milan", country: "Italy",
    tagline: "Espresso at sunrise, long talks after midnight.",
    bio: "Fashion buyer by day, hopeless film nerd by night. I love slow conversations that start with nothing and end up somewhere completely unexpected.",
    price: 24.0, heightCm: 172, languages: ["Italian", "English", "French"],
    interests: ["Cinema", "Vintage fashion", "Cooking", "Jazz"], zodiac: "Libra", hair: "Chestnut", eyes: "Hazel",
  },
  {
    name: "Amara Blake", age: 27, city: "London", country: "United Kingdom",
    tagline: "Ask me about the book I can't stop rereading.",
    bio: "Illustrator living between two studios and far too many sketchbooks. Warm, curious, and genuinely bad at small talk — I skip straight to the good stuff.",
    price: 32.0, heightCm: 168, languages: ["English", "Spanish"],
    interests: ["Illustration", "Poetry", "Long walks", "Vinyl"], zodiac: "Scorpio", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Yuki Tanaka", age: 23, city: "Tokyo", country: "Japan",
    tagline: "Neon streets, quiet mornings, endless playlists.",
    bio: "Sound designer who collects city noise like other people collect postcards. If you send me a song I will send you three back.",
    price: 19.0, heightCm: 163, languages: ["Japanese", "English"],
    interests: ["Music production", "Street photography", "Ramen", "Retro games"], zodiac: "Pisces", hair: "Black", eyes: "Brown",
  },
  {
    name: "Elena Petrova", age: 26, city: "Prague", country: "Czechia",
    tagline: "Architecture student with a weakness for rooftop views.",
    bio: "I spend my weekends measuring old buildings and my evenings arguing about films nobody has seen. Tell me something real and you have my full attention.",
    price: 21.0, heightCm: 175, languages: ["Czech", "English", "Russian"],
    interests: ["Architecture", "Hiking", "Wine", "Chess"], zodiac: "Virgo", hair: "Ash blonde", eyes: "Grey",
  },
  {
    name: "Camila Duarte", age: 25, city: "Lisbon", country: "Portugal",
    tagline: "Salt in my hair, fado on repeat.",
    bio: "Surf instructor turned barista, currently saving for a van. My messages come with too many voice notes and zero filter.",
    price: 27.5, heightCm: 170, languages: ["Portuguese", "English", "Spanish"],
    interests: ["Surfing", "Coffee", "Travel", "Guitar"], zodiac: "Leo", hair: "Dark brown", eyes: "Green",
  },
  {
    name: "Nadia Karim", age: 28, city: "Dubai", country: "UAE",
    tagline: "Business by day, stargazing by night.",
    bio: "Product manager with a desert-camping habit. I am direct, a little competitive, and I will absolutely beat you at trivia.",
    price: 45.0, heightCm: 174, languages: ["Arabic", "English", "French"],
    interests: ["Astronomy", "Padel", "Perfume", "Startups"], zodiac: "Capricorn", hair: "Black", eyes: "Amber",
  },
  {
    name: "Chloe Laurent", age: 24, city: "Paris", country: "France",
    tagline: "Museum benches are my favourite place to think.",
    bio: "Art history graduate working in a small gallery in the 11th. I write long messages and apologise for none of them.",
    price: 38.0, heightCm: 166, languages: ["French", "English", "Italian"],
    interests: ["Art", "Ballet", "Pastries", "Cycling"], zodiac: "Gemini", hair: "Light brown", eyes: "Blue",
  },
  {
    name: "Mia Andersen", age: 26, city: "Copenhagen", country: "Denmark",
    tagline: "Cold water swims and warm conversations.",
    bio: "Interior designer, part-time ceramicist, full-time candle enthusiast. Calm on the outside, extremely opinionated about typography.",
    price: 29.0, heightCm: 177, languages: ["Danish", "English", "German"],
    interests: ["Ceramics", "Design", "Sea swimming", "Baking"], zodiac: "Aquarius", hair: "Blonde", eyes: "Blue",
  },
  {
    name: "Isabela Rocha", age: 23, city: "Sao Paulo", country: "Brazil",
    tagline: "Dance first, explain later.",
    bio: "Choreographer with a chaotic schedule and an even more chaotic playlist. I laugh loudly and I text back fast.",
    price: 18.5, heightCm: 169, languages: ["Portuguese", "English"],
    interests: ["Dance", "Street food", "Football", "Festivals"], zodiac: "Sagittarius", hair: "Dark brown", eyes: "Brown",
  },
  {
    name: "Anika Sharma", age: 27, city: "Mumbai", country: "India",
    tagline: "Screenwriter who talks in scenes.",
    bio: "I write for television and overthink every ending. Ask me about the plot twist I have been sitting on for two years.",
    price: 26.0, heightCm: 165, languages: ["Hindi", "English", "Marathi"],
    interests: ["Screenwriting", "Classical music", "Street markets", "Tea"], zodiac: "Cancer", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Leila Haddad", age: 25, city: "Beirut", country: "Lebanon",
    tagline: "Sunset on the corniche, always.",
    bio: "Photojournalist with a soft spot for stray cats and stubborn people. My camera roll is 80% food, 20% strangers laughing.",
    price: 31.0, heightCm: 171, languages: ["Arabic", "French", "English"],
    interests: ["Photography", "Cooking", "Politics", "Swimming"], zodiac: "Taurus", hair: "Dark brown", eyes: "Green",
  },
  {
    name: "Freya Lindqvist", age: 29, city: "Stockholm", country: "Sweden",
    tagline: "Forest walks and unreasonably strong coffee.",
    bio: "UX researcher who asks too many questions — occupational hazard. Dry humour, warm heart, terrible at ending conversations.",
    price: 34.0, heightCm: 178, languages: ["Swedish", "English"],
    interests: ["Hiking", "Psychology", "Board games", "Skiing"], zodiac: "Aries", hair: "Platinum", eyes: "Ice blue",
  },
  {
    name: "Valentina Cruz", age: 24, city: "Mexico City", country: "Mexico",
    tagline: "Mezcal, murals, and midnight tacos.",
    bio: "Muralist working across the city, usually covered in paint. I believe in long dinners and even longer conversations.",
    price: 22.0, heightCm: 164, languages: ["Spanish", "English"],
    interests: ["Painting", "Mezcal", "Salsa", "Road trips"], zodiac: "Leo", hair: "Black", eyes: "Brown",
  },
  {
    name: "Zara Osei", age: 26, city: "Accra", country: "Ghana",
    tagline: "Building something you'll hear about soon.",
    bio: "Fintech founder, marathon runner, and the person who always plans the group trip. Ambitious but never too busy for a good story.",
    price: 41.0, heightCm: 173, languages: ["English", "Twi", "French"],
    interests: ["Running", "Startups", "Afrobeats", "Fashion"], zodiac: "Capricorn", hair: "Braided black", eyes: "Dark brown",
  },
  {
    name: "Ines Moreau", age: 28, city: "Montreal", country: "Canada",
    tagline: "Winter person, unapologetically.",
    bio: "Pastry chef with flour permanently on my sleeves. I am gentle, stubborn, and I will feed you until you surrender.",
    price: 28.0, heightCm: 167, languages: ["French", "English"],
    interests: ["Baking", "Ice skating", "Jazz clubs", "Novels"], zodiac: "Pisces", hair: "Auburn", eyes: "Hazel",
  },
  {
    name: "Katya Volkova", age: 25, city: "Warsaw", country: "Poland",
    tagline: "Ballet trained, sarcasm certified.",
    bio: "Former dancer now teaching movement to people who insist they can't dance. Blunt, playful, and impossible to bore.",
    price: 23.5, heightCm: 170, languages: ["Polish", "English", "Russian"],
    interests: ["Ballet", "Pilates", "Thrifting", "Horror films"], zodiac: "Scorpio", hair: "Dark blonde", eyes: "Green",
  },
  {
    name: "Maya Cohen", age: 23, city: "Tel Aviv", country: "Israel",
    tagline: "Beach at 6am, code at 10am.",
    bio: "Front-end developer who surfs badly but enthusiastically. I love debates, sunsets, and being convinced I am wrong.",
    price: 25.0, heightCm: 166, languages: ["Hebrew", "English"],
    interests: ["Coding", "Surfing", "Podcasts", "Hummus"], zodiac: "Gemini", hair: "Curly brown", eyes: "Brown",
  },
  {
    name: "Lucia Ferrer", age: 27, city: "Barcelona", country: "Spain",
    tagline: "Sea in the morning, mountains on Sunday.",
    bio: "Marine biologist who spends more time underwater than on land. Curious about everything, especially the things you think are boring.",
    price: 30.0, heightCm: 172, languages: ["Spanish", "Catalan", "English"],
    interests: ["Diving", "Marine life", "Climbing", "Flamenco"], zodiac: "Aquarius", hair: "Dark brown", eyes: "Dark brown",
  },
  {
    name: "Hana Novak", age: 24, city: "Vienna", country: "Austria",
    tagline: "Opera tickets and second-hand bookshops.",
    bio: "Cellist in a chamber ensemble, insomniac reader, terrible liar. If we talk, expect a soundtrack recommendation within ten minutes.",
    price: 33.0, heightCm: 169, languages: ["German", "English", "Czech"],
    interests: ["Cello", "Opera", "Books", "Coffee houses"], zodiac: "Virgo", hair: "Light brown", eyes: "Grey-green",
  },
  {
    name: "Noor Rahman", age: 26, city: "Kuala Lumpur", country: "Malaysia",
    tagline: "Street food expert, sunset chaser.",
    bio: "Travel writer with a permanently half-packed suitcase. I collect night markets and stories from people I have just met.",
    price: 20.5, heightCm: 162, languages: ["Malay", "English", "Mandarin"],
    interests: ["Travel", "Street food", "Writing", "Scooters"], zodiac: "Sagittarius", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Grace Sullivan", age: 29, city: "Dublin", country: "Ireland",
    tagline: "Rain, pubs, and a very loud laugh.",
    bio: "Theatre producer running on caffeine and last-minute miracles. Sharp, warm, and always up for an argument about the ending of a play.",
    price: 36.0, heightCm: 176, languages: ["English", "Irish"],
    interests: ["Theatre", "Whiskey", "Sea cliffs", "Stand-up"], zodiac: "Aries", hair: "Red", eyes: "Green",
  },
  {
    name: "Alina Popescu", age: 25, city: "Bucharest", country: "Romania",
    tagline: "Old films, new cities, strong coffee.",
    bio: "Graphic designer with a growing collection of film cameras. I am quiet at first and then completely unstoppable.",
    price: 17.5, heightCm: 168, languages: ["Romanian", "English", "Italian"],
    interests: ["Design", "Analog photo", "Cats", "Techno"], zodiac: "Cancer", hair: "Dark brown", eyes: "Brown",
  },
  {
    name: "Jasmine Reed", age: 24, city: "Miami", country: "United States",
    tagline: "Sunshine person with a night-owl schedule.",
    bio: "Event host and part-time DJ, so my week starts on Thursday. Playful, direct, and allergic to boring conversations.",
    price: 39.0, heightCm: 171, languages: ["English", "Spanish"],
    interests: ["DJ sets", "Boating", "Fitness", "Sneakers"], zodiac: "Leo", hair: "Honey blonde", eyes: "Hazel",
  },
  {
    name: "Selin Demir", age: 27, city: "Istanbul", country: "Turkey",
    tagline: "Two continents, one very long walk.",
    bio: "Textile designer working with old looms and new ideas. I love bridges, ferries, and conversations that drift.",
    price: 24.5, heightCm: 167, languages: ["Turkish", "English", "German"],
    interests: ["Textiles", "History", "Tea", "Ferries"], zodiac: "Libra", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Marta Kowalska", age: 26, city: "Krakow", country: "Poland",
    tagline: "Mountains on weekends, museums on rainy days.",
    bio: "Veterinarian with three rescued cats and no regrets. Practical, funny, and extremely soft about animals.",
    price: 19.5, heightCm: 165, languages: ["Polish", "English"],
    interests: ["Animals", "Mountains", "Baking", "Crime novels"], zodiac: "Taurus", hair: "Blonde", eyes: "Blue",
  },
  {
    name: "Layla Fitzgerald", age: 23, city: "Sydney", country: "Australia",
    tagline: "Ocean swims and unfinished tattoos.",
    bio: "Marine photographer and part-time bartender. I overshare beautifully and I am always the last one to leave the beach.",
    price: 26.5, heightCm: 173, languages: ["English"],
    interests: ["Swimming", "Tattoos", "Photography", "Camping"], zodiac: "Pisces", hair: "Sun-bleached brown", eyes: "Green",
  },
  {
    name: "Emilia Vogel", age: 28, city: "Berlin", country: "Germany",
    tagline: "Concrete, techno, and Sunday markets.",
    bio: "Sound engineer who spends nights in studios and mornings in parks. Low-key, honest, and very hard to shock.",
    price: 35.0, heightCm: 174, languages: ["German", "English"],
    interests: ["Techno", "Cycling", "Analog synths", "Brunch"], zodiac: "Aquarius", hair: "Platinum", eyes: "Grey",
  },
  {
    name: "Rina Alvarez", age: 25, city: "Manila", country: "Philippines",
    tagline: "Karaoke champion, self-declared.",
    bio: "Nurse working long shifts and recovering with terrible reality TV. Kind by default, sarcastic by evening.",
    price: 16.5, heightCm: 160, languages: ["Filipino", "English"],
    interests: ["Karaoke", "Islands", "Baking", "K-drama"], zodiac: "Cancer", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Tessa van Dijk", age: 26, city: "Amsterdam", country: "Netherlands",
    tagline: "Bike everywhere, complain about nothing.",
    bio: "Landscape architect designing parks I will probably never sit in. Straightforward, curious, and quietly romantic.",
    price: 29.5, heightCm: 179, languages: ["Dutch", "English", "German"],
    interests: ["Gardens", "Cycling", "Canals", "Ceramics"], zodiac: "Virgo", hair: "Blonde", eyes: "Blue",
  },
  {
    name: "Bianca Rossi", age: 24, city: "Rome", country: "Italy",
    tagline: "History student with modern problems.",
    bio: "Doing a masters in classical archaeology and working in a wine bar to fund it. I talk with my hands even over text.",
    price: 23.0, heightCm: 166, languages: ["Italian", "English"],
    interests: ["Archaeology", "Wine", "Scooters", "Pasta"], zodiac: "Gemini", hair: "Dark brown", eyes: "Brown",
  },
  {
    name: "Sana Malik", age: 27, city: "Toronto", country: "Canada",
    tagline: "Lawyer who argues for fun, too.",
    bio: "Corporate lawyer with a stand-up comedy hobby I refuse to explain. Sharp, warm, and impossible to out-talk.",
    price: 44.0, heightCm: 170, languages: ["English", "Urdu", "French"],
    interests: ["Comedy", "Law", "Yoga", "Sushi"], zodiac: "Capricorn", hair: "Black", eyes: "Dark brown",
  },
  {
    name: "Daria Ivanova", age: 25, city: "Riga", country: "Latvia",
    tagline: "Winter light and long train rides.",
    bio: "Film student shooting on 16mm because I like the waiting. Introverted until you find the right topic, then good luck.",
    price: 18.0, heightCm: 172, languages: ["Latvian", "Russian", "English"],
    interests: ["Film", "Trains", "Sauna", "Poetry"], zodiac: "Scorpio", hair: "Dark blonde", eyes: "Blue-grey",
  },
  {
    name: "Olivia Bennett", age: 28, city: "New York", country: "United States",
    tagline: "Gallery openings and 2am diner runs.",
    bio: "Creative director living on iced coffee and deadlines. I am ambitious, blunt, and surprisingly sentimental after midnight.",
    price: 52.0, heightCm: 175, languages: ["English", "French"],
    interests: ["Art direction", "Running", "Wine bars", "Broadway"], zodiac: "Libra", hair: "Dark brown", eyes: "Green",
  },
  {
    name: "Farah Nasser", age: 24, city: "Casablanca", country: "Morocco",
    tagline: "Mint tea, medina walks, endless questions.",
    bio: "Ceramicist working out of my grandmother's old studio. Gentle, curious, and a little obsessed with old doors.",
    price: 21.5, heightCm: 164, languages: ["Arabic", "French", "English"],
    interests: ["Ceramics", "Markets", "Tea", "Calligraphy"], zodiac: "Taurus", hair: "Black", eyes: "Amber",
  },
  {
    name: "Ana Jovanovic", age: 26, city: "Belgrade", country: "Serbia",
    tagline: "River nights and honest opinions.",
    bio: "Psychology graduate working in a bookstore while I finish my thesis. I listen properly and I remember everything.",
    price: 20.0, heightCm: 171, languages: ["Serbian", "English", "German"],
    interests: ["Psychology", "Books", "River clubs", "Rakija"], zodiac: "Sagittarius", hair: "Dark brown", eyes: "Hazel",
  },
  {
    name: "Mei Lin", age: 25, city: "Singapore", country: "Singapore",
    tagline: "Skyline views and hawker centre debates.",
    bio: "Data scientist who treats food rankings as a serious science. Precise, playful, and very hard to impress — try anyway.",
    price: 37.0, heightCm: 163, languages: ["Mandarin", "English", "Malay"],
    interests: ["Data", "Hawker food", "Rooftops", "Badminton"], zodiac: "Aries", hair: "Black", eyes: "Dark brown",
  },
];
