/*
 * KodRobot — bölümler.
 * Bkz. CONTRACT.md ("CodeGame.LEVELS").
 * Harita: '#' duvar, '.' zemin, 'S' başlangıç, 'G' hedef, '*' elmas.
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  CodeGame.LEVELS = [
    // 1 — ilerle
    {
      id: 'l1',
      title: 'İlk Adım',
      description: 'Robotu altın hedefe götür. Her ilerle() komutu robotu bir kare ileri taşır.',
      hint: 'Hedef 4 kare ileride. ilerle() komutunu 4 kez yaz.',
      map: [
        '#######',
        '#S...G#',
        '#######',
      ],
      startDir: 'E',
      starterCode: '// Robotu hedefe götür\nilerle()\n',
      par: 4,
      newConcepts: ['ilerle'],
      solution: `ilerle()
ilerle()
ilerle()
ilerle()
`,
    },

    // 2 — sağa dön
    {
      id: 'l2',
      title: 'İlk Dönüş',
      description: 'Yol köşeden aşağı dönüyor. Robotu döndürmek için sagaDon() ya da solaDon() kullan.',
      hint: 'Önce 2 kare ilerle, sonra sağa dön ve 3 kare daha ilerle.',
      map: [
        '#######',
        '#S..###',
        '###.###',
        '###.###',
        '###G###',
        '#######',
      ],
      startDir: 'E',
      starterCode: '// Köşeye kadar ilerle, sonra dön\nilerle()\n',
      par: 6,
      newConcepts: ['sagaDon', 'solaDon'],
      solution: `ilerle()
ilerle()
sagaDon()
ilerle()
ilerle()
ilerle()
`,
    },

    // 3 — yılan yolu
    {
      id: 'l3',
      title: 'Yılan Yolu',
      description: 'Kıvrımlı yolu takip et. Bu kez hem sağa hem sola dönmen gerekecek.',
      hint: 'Robotun baktığı yöne göre düşün: aşağı inerken sola dönmek robotu doğuya (sağa) çevirir.',
      map: [
        '########',
        '#S.#####',
        '##.#####',
        '##...###',
        '####.G##',
        '########',
      ],
      startDir: 'E',
      starterCode: '// Yolu adım adım takip et\nilerle()\nsagaDon()\n',
      par: 11,
      newConcepts: [],
      solution: `ilerle()
sagaDon()
ilerle()
ilerle()
solaDon()
ilerle()
ilerle()
sagaDon()
ilerle()
solaDon()
ilerle()
`,
    },

    // 4 — topla
    {
      id: 'l4',
      title: 'Elmas Avı',
      description: 'Yoldaki tüm elmasları topla, sonra hedefe ulaş. Elmasın üstündeyken topla() yaz.',
      hint: 'Bir elmasın üzerine geldiğinde topla() komutunu kullan. Hedefe ancak bütün elmaslar toplanınca kazanırsın.',
      map: [
        '########',
        '#S*..###',
        '####*###',
        '####.###',
        '####*G##',
        '########',
      ],
      startDir: 'E',
      starterCode: '// Elmasın üstüne gel ve topla\nilerle()\ntopla()\n',
      par: 12,
      newConcepts: ['topla'],
      solution: `ilerle()
topla()
ilerle()
ilerle()
sagaDon()
ilerle()
topla()
ilerle()
ilerle()
topla()
solaDon()
ilerle()
`,
    },

    // 5 — tekrarla
    {
      id: 'l5',
      title: 'Uzun Koridor',
      description: 'Upuzun bir koridor! ilerle() komutunu dokuz kez yazmak yerine tekrarla kullan.',
      hint: 'tekrarla 9 { ilerle() } yazarsan süslü parantez içindeki komut 9 kez çalışır.',
      map: [
        '############',
        '#S........G#',
        '############',
      ],
      startDir: 'E',
      starterCode: '// Süslü parantezin içi kaç kez tekrarlansın?\ntekrarla 1 {\n  ilerle()\n}\n',
      par: 2,
      newConcepts: ['tekrarla'],
      solution: `tekrarla 9 {
  ilerle()
}
`,
    },

    // 6 — tekrarla ile merdiven
    {
      id: 'l6',
      title: 'Merdiven',
      description: 'Merdivenden aşağı in. Her basamak aynı hareketlerden oluşuyor; bir basamağı tekrarla içine yaz.',
      hint: 'Bir basamak: ilerle, sağa dön, ilerle, sola dön. Bunu 4 kez tekrarla, sonra bir kez daha ilerle.',
      map: [
        '########',
        '#S.#####',
        '##..####',
        '###..###',
        '####..##',
        '#####.G#',
        '########',
      ],
      startDir: 'E',
      starterCode: '// Bir basamağın hareketlerini tekrarla içine yaz\ntekrarla 4 {\n  ilerle()\n}\n',
      par: 6,
      newConcepts: [],
      solution: `tekrarla 4 {
  ilerle()
  sagaDon()
  ilerle()
  solaDon()
}
ilerle()
`,
    },

    // 7 — iç içe tekrarla
    {
      id: 'l7',
      title: 'Kale Duvarı',
      description: 'Kalenin etrafında dolaş ve üç köşedeki elmasları topla. Bir döngünün içine başka bir döngü koyabilirsin!',
      hint: 'Her kenar: 4 kez ilerle, topla, sağa dön. Bunu 3 kez tekrarla; sonra hedefe 3 kare kaldı.',
      map: [
        '#######',
        '#S...*#',
        '#G###.#',
        '#.###.#',
        '#.###.#',
        '#*...*#',
        '#######',
      ],
      startDir: 'E',
      starterCode: '// Bir kenarı yürüyen kodu başka bir tekrarla içine koy\ntekrarla 4 {\n  ilerle()\n}\n',
      par: 7,
      newConcepts: [],
      solution: `tekrarla 3 {
  tekrarla 4 {
    ilerle()
  }
  topla()
  sagaDon()
}
tekrarla 3 {
  ilerle()
}
`,
    },

    // 8 — fonksiyon
    {
      id: 'l8',
      title: 'Elmas Merdiveni',
      description: 'İki kısa merdivenin her basamağında bir elmas var. Bir merdiveni çıkan bir fonksiyon yaz ve onu iki kez çağır.',
      hint: 'fonksiyon merdiven() { ... } ile kendi komutunu tanımla. İçinde 2 basamak çıkıp elmasları topla. Sonra: merdiven(), ilerle(), merdiven(), ilerle().',
      map: [
        '#########',
        '######*G#',
        '#####*.##',
        '###*..###',
        '##*.#####',
        '#S.######',
        '#########',
      ],
      startDir: 'E',
      starterCode: '// Kendi komutunu tanımla\nfonksiyon merdiven() {\n  // basamakları buraya yaz\n}\n\nmerdiven()\n',
      par: 11,
      newConcepts: ['fonksiyon'],
      solution: `fonksiyon merdiven() {
  tekrarla 2 {
    ilerle()
    solaDon()
    ilerle()
    sagaDon()
    topla()
  }
}
merdiven()
ilerle()
merdiven()
ilerle()
`,
    },

    // 9 — iken + onumBos
    {
      id: 'l9',
      title: 'Bilinmeyen Koridor',
      description: 'Koridorların ne kadar uzun olduğunu saymadan robotu hedefe götür. iken döngüsü, koşul doğru olduğu sürece çalışır.',
      hint: 'iken (onumBos()) { ilerle() } robotu duvara kadar yürütür. Sonra sağa dön ve aynısını tekrar yap.',
      map: [
        '##########',
        '#S......##',
        '#######.##',
        '#######.##',
        '#######.##',
        '#######.##',
        '#######G##',
        '##########',
      ],
      startDir: 'E',
      starterCode: '// Önün boş olduğu sürece ilerle\niken (onumBos()) {\n  \n}\n',
      par: 5,
      newConcepts: ['iken', 'onumBos'],
      solution: `iken (onumBos()) {
  ilerle()
}
sagaDon()
iken (onumBos()) {
  ilerle()
}
`,
    },

    // 10 — hedefte + !
    {
      id: 'l10',
      title: 'Sonsuz Merdiven',
      description: 'Bu merdiven çok uzun! Basamakları saymak yerine robot hedefe varana kadar inmeye devam etsin.',
      hint: '! işareti "değil" demektir. iken (!hedefte()) { ... } robot hedefte olmadığı sürece döner.',
      map: [
        '##########',
        '#S.#######',
        '##..######',
        '###..#####',
        '####..####',
        '#####..###',
        '######..##',
        '#######..#',
        '########G#',
        '##########',
      ],
      startDir: 'E',
      starterCode: '// Hedefte değilken bir basamak in\niken (!hedefte()) {\n  \n}\n',
      par: 5,
      newConcepts: ['hedefte', '!'],
      solution: `iken (!hedefte()) {
  ilerle()
  sagaDon()
  ilerle()
  solaDon()
}
`,
    },

    // 11 — eger + elmasVar
    {
      id: 'l11',
      title: 'Dağınık Elmaslar',
      description: 'Elmaslar koridora rastgele saçılmış. Her karede elmas var mı diye bak, varsa topla.',
      hint: 'eger (elmasVar()) { topla() } yalnızca elmasın üstündeyken toplar. Bunu iken döngüsünün içine koy.',
      map: [
        '############',
        '#S.*.**..*G#',
        '############',
      ],
      startDir: 'E',
      starterCode: '// Hedefe kadar yürü, elmas görürsen topla\niken (!hedefte()) {\n  ilerle()\n}\n',
      par: 4,
      newConcepts: ['eger', 'elmasVar'],
      solution: `iken (!hedefte()) {
  ilerle()
  eger (elmasVar()) {
    topla()
  }
}
`,
    },

    // 12 — eger / degilse + yan sensörler
    {
      id: 'l12',
      title: 'Kıvrımlı Yol',
      description: 'Robot yolu kendisi bulsun: önü boşsa ilerlesin, değilse sağın ya da solun açık olduğu tarafa dönsün. Elmasları da unutma!',
      hint: 'eger (onumBos()) { ... } degilse eger (sagimBos()) { ... } degilse { ... } yapısı üç durumu da kapsar.',
      map: [
        '###########',
        '#S..*######',
        '####.######',
        '####.*..###',
        '#######*###',
        '#G.*....###',
        '###########',
      ],
      startDir: 'E',
      starterCode: '// Önün boşsa ilerle, değilse dön\niken (!hedefte()) {\n  eger (onumBos()) {\n    ilerle()\n  } degilse {\n    \n  }\n}\n',
      par: 9,
      newConcepts: ['degilse', 'sagimBos', 'solumBos'],
      solution: `iken (!hedefte()) {
  eger (elmasVar()) {
    topla()
  }
  eger (onumBos()) {
    ilerle()
  } degilse eger (sagimBos()) {
    sagaDon()
  } degilse {
    solaDon()
  }
}
`,
    },

    // 13 — && / ||
    {
      id: 'l13',
      title: 'Çıkmaz Sokak',
      description: 'Robot önce bir çıkmaz sokağa giriyor. Önü, sağı VE solu kapalıysa geri dönmeli. && "ve", || "veya" demektir.',
      hint: 'Çıkmaz sokak: !onumBos() && !sagimBos() && !solumBos(). Aynı şey !(onumBos() || sagimBos() || solumBos()) diye de yazılabilir. Geri dönmek için iki kez sağa dön.',
      map: [
        '###########',
        '##.*.S..*##',
        '##.########',
        '##..*..####',
        '######...G#',
        '###########',
      ],
      startDir: 'E',
      starterCode: '// Çıkmazda geri dön, köşede açık tarafa dön\niken (!hedefte()) {\n  eger (onumBos()) {\n    ilerle()\n  }\n}\n',
      par: 12,
      newConcepts: ['&&', '||'],
      solution: `iken (!hedefte()) {
  eger (elmasVar()) {
    topla()
  }
  eger (onumBos()) {
    ilerle()
  } degilse eger (!sagimBos() && !solumBos()) {
    sagaDon()
    sagaDon()
  } degilse eger (sagimBos()) {
    sagaDon()
  } degilse {
    solaDon()
  }
}
`,
    },

    // 14 — sağ el kuralı
    {
      id: 'l14',
      title: 'Labirent',
      description: 'Bir labirentten çıkmanın sihirli yolu: sağ elini hep duvarda tut! Sağın açıksa sağa dön ve ilerle, değilse önün açıksa ilerle, o da değilse sola dön.',
      hint: 'Sağ el kuralı: eger (sagimBos()) { sagaDon(); ilerle() } degilse eger (onumBos()) { ilerle() } degilse { solaDon() } — bunu hedefe varana kadar tekrarla.',
      map: [
        '###########',
        '#S..#.....#',
        '###.#.###.#',
        '#...#...#.#',
        '#.#####.#.#',
        '#.....#.#.#',
        '#####.#.#.#',
        '#........G#',
        '###########',
      ],
      startDir: 'E',
      starterCode: '// Sağ elini duvardan ayırma\niken (!hedefte()) {\n  eger (sagimBos()) {\n    \n  }\n}\n',
      par: 8,
      newConcepts: [],
      solution: `iken (!hedefte()) {
  eger (sagimBos()) {
    sagaDon()
    ilerle()
  } degilse eger (onumBos()) {
    ilerle()
  } degilse {
    solaDon()
  }
}
`,
    },

    // 15 — final
    {
      id: 'l15',
      title: 'Büyük Final',
      description: 'Elmaslarla dolu bir labirent! Bu kez sol elini duvarda tut ve yolda bulduğun tüm elmasları topla. Öğrendiğin her şeyi kullan.',
      hint: 'Elmas kontrolünü kendi fonksiyonuna koy, sonra sol el kuralını uygula: solun açıksa sola dön ve ilerle, değilse önün açıksa ilerle, o da değilse sağa dön.',
      map: [
        '###########',
        '#S....#..*#',
        '#.###.#.#.#',
        '#*#...#.#.#',
        '###.###.#.#',
        '#*..#...#.#',
        '#.#.#.###.#',
        '#G#...#*..#',
        '###########',
      ],
      startDir: 'W',
      starterCode: '// Elmas varsa topla\nfonksiyon kontrol() {\n  \n}\n\niken (!hedefte()) {\n  kontrol()\n}\n',
      par: 12,
      newConcepts: [],
      solution: `fonksiyon kontrol() {
  eger (elmasVar()) {
    topla()
  }
}
iken (!hedefte()) {
  kontrol()
  eger (solumBos()) {
    solaDon()
    ilerle()
  } degilse eger (onumBos()) {
    ilerle()
  } degilse {
    sagaDon()
  }
}
`,
    },
  ];

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
