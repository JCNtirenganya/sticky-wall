/* Tiny translation layer shared by the presenter board and the phone page.
   English is the source language: the key IS the English text, so adding a
   string needs no English entry. Only French is stored.

   Usage
     t("Live notes")                       → translated string
     t("{n} notes", { n: 4 })              → translated with placeholders
     <span data-i18n="Live notes"></span>  → translated on load
     data-i18n-placeholder / -title / -aria / -alt for attributes

   Changing language stores the choice and reloads, so every dynamically
   rendered string (dashboard, status bar) is rebuilt in the new
   language without chasing stale nodes. */

(function () {
  const STORAGE_KEY = "sticky_lang";
  const LANGS = {
    en: { name: "English", short: "EN", html: "en" },
    fr: { name: "Français", short: "FR", html: "fr" }
  };

  const DICT = {
    fr: {
      /* ── shared ─────────────────────────────────────────────── */
      "Board": "Tableau",
      "{title} · Board": "{title} · Tableau",
      "Language": "Langue",
      "English": "Anglais",
      "Français": "Français",
      "Sticky note": "Note adhésive",
      "{label} by {author}: {text}": "{label} par {author} : {text}",

      /* ── phone · name ───────────────────────────────────────── */
      "Before we start": "Avant de commencer",
      "What should we call you?": "Comment devons-nous vous appeler ?",
      "A name or nickname": "Un nom ou un surnom",
      "Continue": "Continuer",
      "Your name appears with your note on the wall.": "Votre nom apparaît avec votre note sur le mur.",

      /* ── phone · categories ─────────────────────────────────── */
      "New note": "Nouvelle note",
      "What’s on your mind?": "À quoi pensez-vous ?",
      "Pick a colour, then write.": "Choisissez une couleur, puis écrivez.",
      "Note categories": "Catégories de notes",
      "Demo mode · notes stay in this browser": "Mode démo · les notes restent dans ce navigateur",
      "Posting as {name} · change": "Publication en tant que {name} · changer",
      "What do you want to do?": "Que voulez-vous faire ?",
      "Pick one to start. You can switch anytime.": "Choisissez-en un pour commencer. Vous pouvez changer à tout moment.",
      "Write a note for the wall.": "Écrivez une note pour le mur.",
      "Share a photo or short video.": "Partagez une photo ou une courte vidéo.",
      "Back to modules": "Retour aux modules",

      /* ── phone · write ──────────────────────────────────────── */
      "Back": "Retour",
      "Your note": "Votre note",
      "Stick it on the wall": "Coller sur le mur",
      "Easy! Wait {n}s": "Doucement ! Attendez {n}s",
      "Stuck on the wall!": "Collée sur le mur !",
      "Couldn't send — try again": "Envoi impossible — réessayez",

      /* ── share ──────────────────────────────────────────────── */
      "Sending…": "Envoi…",
      "Anonymous": "Anonyme",
      "Share": "Partager",
      "Live wall link": "Lien du mur en direct",
      "Anyone with this link or embed sees the notes update live.": "Toute personne disposant de ce lien ou de cette intégration voit les notes se mettre à jour en direct.",
      "Link": "Lien",
      "Embed code": "Code d'intégration",
      "Copy": "Copier",
      "Copied": "Copié",
      "Open preview": "Aperçu",
      "Done": "Terminé",
      "Updates live": "Mise à jour en direct",
      "Live notes": "Notes en direct",
      "Offline": "Hors ligne",
      "Waiting for the first note…": "En attente de la première note…",
      "Could not load the notes.": "Impossible de charger les notes.",

      /* ── board · empty ──────────────────────────────────────── */
      "The wall is waiting.": "Le mur vous attend.",
      "Notes land here the moment someone sends one. Scan the QR code or open the link to add the first note.": "Les notes arrivent ici dès qu'elles sont envoyées. Scannez le QR code ou ouvrez le lien pour ajouter la première note.",
      "name this wall": "nommer ce mur",
      "edit categories": "modifier les catégories",

      /* ── board · dashboard ──────────────────────────────────── */
      "Presenter dashboard": "Tableau de bord du présentateur",
      "You received 0 notes.": "Vous avez reçu 0 note.",
      "You received 1 note.": "Vous avez reçu 1 note.",
      "You received {n} notes.": "Vous avez reçu {n} notes.",
      "{n} on the wall": "{n} sur le mur",
      " · {n} hidden": " · {n} masquée(s)",
      "Restore": "Restaurer",
      "Hide": "Masquer",
      "Restore {n} hidden": "Restaurer {n} masquée(s)",
      "Notes": "Notes",
      "returns to the wall · hidden notes stay here until restored": "revient au mur · les notes masquées restent ici jusqu'à leur restauration",
      "Notes grouped by category": "Notes groupées par catégorie",
      "Show these notes.": "Afficher ces notes.",
      "Back to the wall": "Retour au mur",

      /* ── board · status ─────────────────────────────────────── */
      "1 note": "1 note",
      "{n} notes": "{n} notes",
      " · grouped": " · groupées",
      "{n} hidden": "{n} masquée(s)",
      "{shown} of {alive}": "{shown} sur {alive}",
      "demo": "démo",
      "live": "en direct",

      /* ── board · extras ─────────────────────────────────────── */
      "Presenter controls": "Contrôles du présentateur",
      "Everything in one place. Changes apply immediately.": "Tout au même endroit. Les changements s'appliquent immédiatement.",
      "Defaults": "Par défaut",
      "Advanced": "Avancé",
      "Look": "Apparence",
      "Data": "Données",
      "Close (Esc)": "Fermer (Échap)",
      "Copy a read-only link or iframe. It updates live and needs no login.": "Copiez un lien ou un iframe en lecture seule. Il se met à jour en direct et ne demande aucune connexion.",
      "On the wall": "Sur le mur",
      "Wall colour": "Couleur du mur",
      "Logo": "Logo",
      "Dashboard": "Tableau de bord",
      "Reset view": "Réinitialiser la vue",
      "Restore hidden": "Restaurer les masquées",
      "Clear wall": "Vider le mur",
      "Categories in columns": "Catégories en colonnes",
      "Each category starts its own column when the wall has room": "Chaque catégorie commence sa propre colonne quand le mur a de la place",
      "Note spacing": "Espacement des notes",
      "QR code": "QR code",
      "Filter bar": "Barre de filtres",
      "Wall colour presets": "Couleurs de mur prédéfinies",
      "Default textured wall": "Mur texturé par défaut",
      "Black wall": "Mur noir",
      "Charcoal wall": "Mur anthracite",
      "Slate blue wall": "Mur bleu ardoise",
      "Deep green wall": "Mur vert profond",
      "Plum wall": "Mur prune",
      "Warm brown wall": "Mur brun chaud",
      "Custom wall colour": "Couleur de mur personnalisée",
      "Custom colour": "Couleur personnalisée",
      "Dashboard colour": "Couleur du tableau de bord",
      "Dashboard colour presets": "Couleurs du tableau de bord prédéfinies",
      "Custom dashboard colour": "Couleur du tableau de bord personnalisée",
      "Default paper": "Papier par défaut",
      "Cream dashboard": "Tableau de bord crème",
      "Peach dashboard": "Tableau de bord pêche",
      "Mint dashboard": "Tableau de bord menthe",
      "Sky dashboard": "Tableau de bord ciel",
      "Charcoal dashboard": "Tableau de bord anthracite",
      "Reset": "Réinitialiser",
      "Background image…": "Image de fond…",
      "Remove image": "Supprimer l'image",
      "…or paste an image URL": "…ou collez une URL d'image",
      "Set": "Définir",
      "Image dim": "Assombrissement de l'image",
      "Change logo…": "Changer le logo…",
      "Default logo": "Logo par défaut",
      "…or paste a logo URL": "…ou collez une URL de logo",
      "Logo size": "Taille du logo",
      "Notes only": "Notes seulement",
      "Show all": "Tout afficher",
      "Show or hide presenter controls (H)": "Afficher ou masquer les contrôles du présentateur (H)",

      /* ── board · QR ─────────────────────────────────────────── */
      "Scan to take part": "Scannez pour participer",
      "Open {url}": "Ouvrir {url}",

      "Close": "Fermer",
      "closes": "ferme",
      "Confirm clear": "Confirmer le vidage",
      "Select a word, then paste a link to embed it.": "Sélectionnez un mot, puis collez un lien pour l'intégrer.",
      "Link embedded": "Lien intégré",
      "That link is too long for this note": "Ce lien est trop long pour cette note",
      "Present": "Présenter",
      "Manual": "Manuel",
      "No auto": "Sans auto",
      "Present without autoplay (M)": "Présenter sans lecture automatique (M)",
      "Show the notes without autoplay (M)": "Afficher les notes sans lecture automatique (M)",
      "Presentation": "Présentation",
      "Autoplay in full screen": "Lecture automatique en plein écran",
      "Start after": "Démarrer après",
      "Seconds per slide": "Secondes par diapositive",

      "Presenter": "Présentateur",
      "optional": "facultatif",
      "Cancel": "Annuler",

      /* ── categories ─────────────────────────────────────────── */
      "Question": "Question",
      "Questions": "Questions",
      "Ideas": "Idées",
      "All": "Tous",
      "Ask a question": "Poser une question",
      "What are you wondering?": "Qu'est-ce qui vous intrigue ?",
      "Idea": "Idée",
      "Give an idea": "Proposer une idée",
      "What if we…": "Et si nous…",
      "Appreciation": "Appréciation",
      "Thanks": "Merci",
      "Share appreciation": "Exprimer sa gratitude",
      "Say thank you…": "Dites merci…",
      "Resource": "Ressource",
      "Resources": "Ressources",
      "Share a resource": "Partager une ressource",
      "A link, tool or reading…": "Un lien, un outil ou une lecture…",
      "Request": "Demande",
      "Requests": "Demandes",
      "Make a request": "Faire une demande",
      "What do you need help with?": "De quelle aide avez-vous besoin ?",
      "Note": "Note",

      /* ── category editor ────────────────────────────────────── */
      "Categories": "Catégories",
      "Add, rename, recolour or remove note types. Removing one moves its notes to the first category.": "Ajoutez, renommez, recolorez ou supprimez des types de notes. Supprimer un type déplace ses notes vers la première catégorie.",
      "+ Add category": "+ Ajouter une catégorie",
      "Use defaults": "Valeurs par défaut",
      "Save": "Enregistrer",
      "Category name": "Nom de la catégorie",
      "Category colour": "Couleur de la catégorie",
      "Category emoji": "Emoji de la catégorie",
      "Remove category": "Supprimer la catégorie",
      "Remove this category": "Supprimer cette catégorie",
      "Maximum {n} categories": "Maximum {n} catégories",
      "New category": "Nouvelle catégorie",
      "Write your note…": "Écrivez votre note…",
      "Categories changed on this screen only": "Catégories modifiées sur cet écran uniquement",

      /* ── event dialog ───────────────────────────────────────── */
      "Name this wall": "Nommer ce mur",
      "Shown large on the board, above the notes.": "Affiché en grand sur le tableau, au-dessus des notes.",
      "Event name": "Nom de l'événement",
      "Subtitle": "Sous-titre",
      "e.g. Sanokip Annual Meeting": "ex. Réunion annuelle Sanokip",
      "e.g. Notes from the room": "ex. Notes de la salle",
      "Edit event name": "Modifier le nom de l'événement",
      "Edit categories and colours": "Modifier les catégories et les couleurs",

      /* ── focus · filters · piles ────────────────────────────── */
      "Filter notes": "Filtrer les notes",
      "Previous note": "Note précédente",
      "Next note": "Note suivante",
      "Hide note": "Masquer la note",
      "Hide this note from the wall": "Masquer cette note du mur",
      "close": "fermer",
      "All piles": "Toutes les piles",
      "Open pile": "Ouvrir la pile",
      "note": "note",
      "notes": "notes",
      "Filter: {name} ({n})": "Filtrer : {name} ({n})",
      "{i} of {n}": "{i} sur {n}",

      /* ── status messages ────────────────────────────────────── */
      "Could not read that image": "Impossible de lire cette image",
      "That image is too large to save — try a smaller file.": "Cette image est trop lourde pour être enregistrée — essayez un fichier plus petit.",
      "That logo is too large to save — try a smaller file.": "Ce logo est trop lourd pour être enregistré — essayez un fichier plus petit.",
      "That does not look like an image URL": "Cela ne ressemble pas à une URL d'image",

      "Live": "En direct",
      "Notes image JPEG": "Image des notes JPEG",
      "Nothing to export yet": "Rien à exporter pour le moment",
      "Preparing image…": "Préparation de l'image…",
      "Image saved": "Image enregistrée",
      "Could not save the image": "Impossible d'enregistrer l'image",
      "Save as PDF": "Enregistrer au format PDF",

      /* ── event media (photos & short videos) ────────────────── */
      "Media wall": "Mur des médias",
      "Show media wall": "Afficher le mur des médias",
      "Hide media wall": "Masquer le mur des médias",
      "Phones upload here; only this board shows the wall.": "Les téléphones envoient ici ; seul ce mur affiche les médias.",
      "Autoplay videos": "Lecture automatique des vidéos",
      "Mute videos": "Couper le son des vidéos",
      "Loop videos": "Lire les vidéos en boucle",
      "Most recent": "Les plus récentes",
      "items": "éléments",
      "Event media wall": "Mur des médias de l'événement",
      "Hide all": "Tout masquer",
      "Waiting for the first photo or video…": "En attente de la première photo ou vidéo…",
      "Confirm hide all": "Confirmer tout masquer",
      "Shared photo": "Photo partagée",
      "Video": "Vidéo",
      "Photo": "Photo",
      "Guest": "Invité",
      "Remove": "Retirer",
      "Remove from wall": "Retirer du mur",
      "Sure?": "Sûr ?",
      "Removing…": "Suppression…",
      "Could not remove": "Impossible de retirer",
      "Event media": "Médias de l'événement",
      "Share a moment": "Partagez un moment",
      "Your photo or short video appears on the big screen. Phones never show the wall.": "Votre photo ou courte vidéo apparaît sur le grand écran. Les téléphones n'affichent jamais le mur.",
      "Choose a photo or video": "Choisissez une photo ou une vidéo",
      "Preview": "Aperçu",
      "Choose another": "Choisir un autre",
      "Send to the big screen": "Envoyer au grand écran",
      "Too large. Choose a file under 50 MB.": "Fichier trop volumineux. Choisissez un fichier de moins de 50 Mo.",
      "Videos must be 15 seconds or shorter": "Les vidéos doivent durer 15 secondes ou moins",
      "Up to 15 seconds": "Jusqu'à 15 secondes",
      "Could not read this file": "Impossible de lire ce fichier",
      "Sending…": "Envoi…",
      "Sent to the big screen": "Envoyé au grand écran",

      /* ── media capture picker ───────────────────────────────── */
      "or": "ou",
      "Take a photo": "Prendre une photo",
      "Opens your camera app": "Ouvre votre application photo",
      "Record a video": "Enregistrer une vidéo",
      "Up to 15 seconds": "Jusqu'à 15 secondes",
      "Browse photos and videos": "Parcourir les photos et vidéos",
      "Pick a file from this device": "Choisissez un fichier sur cet appareil",
      "Use your camera app's filters, effects or AI editing, then capture or pick the result here.": "Utilisez les filtres, effets ou retouches IA de votre application photo, puis capturez ou choisissez le résultat ici.",

      /* ── media full-screen album ────────────────────────────── */
      "Play full screen": "Lire en plein écran",
      "Exit full screen": "Quitter le plein écran",
      "Full screen": "Plein écran",
      "Full screen (Shift+F)": "Plein écran (Maj+F)",
      "Exit full screen (Shift+F)": "Quitter le plein écran (Maj+F)",
      "Play media full screen": "Lire les médias en plein écran",
      "Play media full screen (F)": "Lire les médias en plein écran (F)",
      "Autoplay": "Lecture auto",
      "Previous": "Précédent",
      "Next": "Suivant",

      /* ── live from a phone ─────────────────────────────────── */
      "Go live from your camera.": "Passez en direct avec votre caméra.",
      "Live from your phone": "En direct depuis votre téléphone",
      "Go live": "Passer en direct",
      "Only the event board sees your camera. Nothing is recorded.": "Seul l'écran de l'événement voit votre caméra. Rien n'est enregistré.",
      "Your camera is off": "Votre caméra est éteinte",
      "Start when you are ready.": "Démarrez quand vous êtes prêt.",
      "Start live": "Démarrer le direct",
      "Stop live": "Arrêter le direct",
      "Flip camera": "Changer de caméra",
      "Mute mic": "Couper le micro",
      "Unmute mic": "Activer le micro",
      "Record a short video instead": "Enregistrer plutôt une courte vidéo",
      "Works when a network blocks live video": "Fonctionne si le réseau bloque la vidéo en direct",
      "Connecting…": "Connexion…",
      "Waiting for the board…": "En attente du tableau…",
      "You're live": "Vous êtes en direct",
      "Reconnecting…": "Reconnexion…",
      "This network may block live video. Record a short video instead?": "Ce réseau peut bloquer la vidéo en direct. Enregistrer plutôt une courte vidéo ?",
      "Live ended": "Direct terminé",
      "Could not start the camera": "Impossible de démarrer la caméra",
      "Live video is not supported here": "La vidéo en direct n'est pas prise en charge ici",
      "Camera off": "Caméra éteinte",
      "Live from phones": "En direct depuis les téléphones",
      "{n} live": "{n} en direct",

      /* ── presenter modules, split, requests, reactions ─────── */
      "Modules": "Modules",
      "Media": "Médias",
      "Stream": "Direct",
      "Live stream": "Direct",
      "Choose a module": "Choisir un module",
      "What should fill the screen?": "Que doit remplir l'écran ?",
      "Pick one module to activate. You can split the screen later.": "Choisissez un module à activer. Vous pourrez diviser l'écran ensuite.",
      "Everything the room wrote, on the wall.": "Tout ce que la salle a écrit, sur le mur.",
      "Photos and short videos from phones.": "Photos et courtes vidéos des téléphones.",
      "Approved phone cameras, live.": "Caméras de téléphone autorisées, en direct.",
      "pick a module": "choisissez un module",
      "Module home": "Accueil des modules",
      "Split screen": "Écran divisé",
      "Split screen…": "Écran divisé…",
      "Pick two or more modules to show side by side. Use this when the screen or projector is large enough.": "Choisissez deux modules ou plus à afficher côte à côte. Utilisez ceci si l'écran ou le projecteur est assez grand.",
      "Show split": "Afficher la division",
      "Exit split": "Quitter la division",
      "Choose what fills the screen, or show two or more modules side by side.": "Choisissez ce qui remplit l'écran, ou affichez deux modules ou plus côte à côte.",
      "Pick at least two modules.": "Choisissez au moins deux modules.",

      /* go-live requests */
      "Go-live requests": "Demandes de direct",
      "Only you can allow a phone to go live, and you choose where it appears.": "Vous seul pouvez autoriser un téléphone à passer en direct, et vous choisissez où il apparaît.",
      "No pending requests.": "Aucune demande en attente.",
      "Review live requests": "Examiner les demandes de direct",
      "Review requests": "Examiner les demandes",
      "Asking to go live": "Demande à passer en direct",
      "Place the live window": "Placer la fenêtre du direct",
      "Allow": "Autoriser",
      "Deny": "Refuser",
      "Stream page": "Page du direct",
      "Floating window": "Fenêtre flottante",
      "Split with media": "Division avec les médias",
      "Live approved · {where}": "Direct autorisé · {where}",
      "Live request denied": "Demande de direct refusée",
      "{n} go-live requests": "{n} demandes de direct",
      "No live stream yet": "Aucun direct pour l'instant",
      "Open media wall": "Ouvrir le mur des médias",
      "Present the stream full screen (F)": "Afficher le direct en plein écran (F)",
      "Close live window": "Fermer la fenêtre du direct",

      /* reactions */
      "React": "Réagir",
      "Reactions": "Réactions",
      "Wall": "Mur",

      /* media presentation timing */
      "Seconds per photo": "Secondes par photo",
      "Video speed": "Vitesse de la vidéo",

      /* phone: request first, then reactions */
      "The presenter must allow your camera before it opens.": "L'animateur doit autoriser votre caméra avant qu'elle ne s'ouvre.",
      "Asking the presenter…": "Demande à l'animateur…",
      "Asking…": "Demande…",
      "Opening the camera…": "Ouverture de la caméra…",
      "The presenter did not allow the camera": "L'animateur n'a pas autorisé la caméra",
      "Request cancelled": "Demande annulée",
      "The request expired. Ask again.": "La demande a expiré. Demandez à nouveau.",
      "Cancel request": "Annuler la demande",
      "Could not switch the camera": "Impossible de changer de caméra",

      /* presenter: passphrase reset */
      "Start fresh": "Repartir à zéro",
      "Clear all submissions": "Effacer toutes les contributions",
      "Clear all submissions?": "Effacer toutes les contributions ?",
      "Presenter passphrase": "Mot de passe du présentateur",
      "Delete everything": "Tout supprimer",
      "Enter the presenter passphrase.": "Saisissez le mot de passe du présentateur.",
      "Clearing…": "Suppression…",
      "Wrong passphrase. Try again.": "Mot de passe incorrect. Réessayez.",
      "Too many attempts. Try again later.": "Trop de tentatives. Réessayez plus tard.",
      "Presenter reset is not set up yet.": "La réinitialisation du présentateur n'est pas encore configurée.",
      "Could not clear submissions. Try again.": "Impossible d'effacer les contributions. Réessayez.",
      "All submissions cleared": "Toutes les contributions ont été effacées.",

      /* pre-existing gaps kept in the French table */
      "Edit event name (E)": "Modifier le nom de l'événement (E)",
      "Edit categories and colours (C)": "Modifier les catégories et les couleurs (C)",
      "Hide this note from the wall (X)": "Masquer cette note du mur (X)",

      /* ── dates, module shortcuts, highlights ────────────────── */
      "Settings": "Paramètres",
      "All days": "Tous les jours",
      "Open {module}": "Ouvrir {module}",
      "Highlights": "À retenir",
      "Highlights report": "Rapport des moments forts",
      "Themes, quotes and participation drawn from every note on the wall.": "Thèmes, citations et participation tirés de toutes les notes du mur.",
      "AI summary": "Résumé IA",
      "Local summary": "Résumé local",
      "Themes": "Thèmes",
      "In their words": "Dans leurs mots",
      "Participation": "Participation",
      "Contributors": "Contributeurs",
      "Days": "Jours",
      "Summary": "Résumé",
      "Unknown": "Inconnu",
      "Named contributors": "Contributeurs nommés",
      "Anonymous notes": "Notes anonymes",
      "First note": "Première note",
      "Last note": "Dernière note",
      "Media on the wall": "Médias sur le mur",
      "Notes on the wall": "Notes sur le mur",
      "There are no notes on the wall yet.": "Il n'y a pas encore de notes sur le mur.",
      "One note came in from {people} contributor.": "Une note est arrivée de {people} contributeur.",
      "{n} notes came in from {people} contributors.": "{n} notes sont arrivées de {people} contributeurs.",
      "Most of the writing sits in {theme}.": "L'essentiel des écrits se trouve dans {theme}.",
      "The words that return most often are {words}.": "Les mots qui reviennent le plus souvent sont {words}.",
      "Recurring words: {words}.": "Mots récurrents : {words}.",
      "Quiet, personal notes.": "Des notes discrètes et personnelles.",
      "{span} · written {date}": "{span} · rédigé le {date}",
      "No notes to report yet.": "Aucune note à résumer pour l'instant.",
      "Notes appear here as soon as the wall receives one.": "Les notes apparaissent ici dès que le mur en reçoit une.",
      "Reading the wall…": "Lecture du mur…",
      "Highlights written from the notes on this wall.": "Moments forts rédigés à partir des notes de ce mur.",
      "Local highlights extracted from the notes on this wall.": "Moments forts extraits localement des notes de ce mur.",

      /* ── shortcuts panel and pointer presentation controls ───── */
      "Shortcuts": "Raccourcis",
      "Close or go back": "Fermer ou revenir",
      "Notes wall": "Mur des notes",
      "Stream wall": "Mur en direct",
      "Present notes": "Présenter les notes",
      "Notes without autoplay": "Notes sans lecture auto",
      "Present media": "Présenter les médias",
      "Present stream": "Présenter le direct",
      "Edit categories": "Modifier les catégories",
      "QR card": "Carte QR",
      "Category filter bar": "Barre des catégories",
      "All categories": "Toutes les catégories",
      "Category 1–9": "Catégorie 1–9",
      "Restore hidden notes": "Restaurer les notes masquées",
      "Switch language": "Changer de langue",
      "Navigation": "Navigation",
      "Slide controls": "Commandes de diapositives",
      "Autoplay on": "Lecture auto activée",
      "Autoplay off": "Lecture auto désactivée",
      "QR card on": "Carte QR affichée",
      "QR card off": "Carte QR masquée",
      "Keyboard shortcuts": "Raccourcis clavier",
      "Keyboard shortcuts (?)": "Raccourcis clavier (?)",
      "Every function has a key. Click a label to run it with a pointer.": "Chaque fonction a sa touche. Cliquez sur un libellé pour la lancer à la souris.",
      "Destructive actions stay in Settings, behind a confirmation.": "Les actions irréversibles restent dans Paramètres, derrière une confirmation.",

      "Mute": "Couper le son",
      "Unmute": "Activer le son"
    }
  };

  function readLang() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return LANGS[value] ? value : "en";
    } catch { return "en"; }
  }

  let current = readLang();

  function t(key, vars) {
    const table = DICT[current] || {};
    let out = table[key];
    if (out == null) out = key;
    if (vars) {
      out = String(out).replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] == null ? match : String(vars[name]));
    }
    return out;
  }

  function lang() { return current; }
  function locale() { return LANGS[current].html; }

  function setLang(code) {
    if (!LANGS[code] || code === current) return false;
    current = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    location.reload();
    return true;
  }

  const ATTR_MAP = [
    ["data-i18n", "textContent"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-title", "title"],
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-alt", "alt"]
  ];

  function apply(root) {
    const scope = root || document;
    ATTR_MAP.forEach(([attr, prop]) => {
      scope.querySelectorAll("[" + attr + "]").forEach(el => {
        const value = t(el.getAttribute(attr));
        if (prop === "textContent") el.textContent = value;
        else el.setAttribute(prop, value);
      });
    });
    document.documentElement.lang = LANGS[current].html;
  }

  function mountSwitches() {
    document.querySelectorAll("[data-lang-switch]").forEach(host => {
      host.replaceChildren();
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", t("Language"));
      Object.entries(LANGS).forEach(([code, meta]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lang-btn" + (code === current ? " is-active" : "");
        button.textContent = meta.short;
        button.title = t(meta.name);
        button.setAttribute("aria-label", t(meta.name));
        button.setAttribute("aria-pressed", code === current ? "true" : "false");
        button.addEventListener("click", () => setLang(code));
        host.appendChild(button);
      });
    });
  }

  function init() {
    apply(document);
    mountSwitches();
  }

  window.I18N = {
    LANGS,
    lang,
    locale,
    setLang,
    t,
    apply,
    mountSwitches,
    init
  };
  window.t = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
