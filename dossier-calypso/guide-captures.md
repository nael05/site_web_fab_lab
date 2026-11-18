# Guide des captures d'écran (terminal)

Dossier où enregistrer les images : `C:\Users\Nael\Desktop\site_web_fab_lab\dossier-calypso\captures\`

## Comment faire (pour chaque capture)
1. Ouvre un terminal PowerShell sur ton PC.
2. Tape (ou colle) UNE commande, appuie sur Entrée, attends la fin.
3. Windows + Maj + S, sélectionne la fenêtre du terminal, puis enregistre l'image avec le nom indiqué.

Les commandes se tapent depuis PowerShell : `ssh <machine> "<commande>"` lance la commande sur la VM.

## Captures

**t01-wg-gw.png** : le tunnel vu de gw. On doit voir 2 pairs (agence et nomade) avec « latest handshake » de quelques secondes.
    ssh gw "sudo wg show"

**t02-wg-agence.png** : le tunnel vu de agence, puis « enabled » (lancé au démarrage).
    ssh agence "sudo wg show"
    ssh agence "systemctl is-enabled wg-quick@wg0"

**t03-agence-adresses-ssh.png** : E1. ens37 (WAN) + ens38 en 10.10.30.1/24 ; root interdit, mot de passe interdit.
    ssh agence "ip -br addr"
    ssh agence "sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication)'"

**t04-flux-agence.png** : E3. Les 3 premiers passent (1 received, web.calypso.internal 10.10.20.10, 200), le 4e est refusé (timed out). Les 4 commandes dans la même capture.
    ssh agence "ping -I 10.10.30.1 -c1 10.10.10.10"
    ssh agence "dig +short -b 10.10.30.1 @10.10.10.10 intranet.calypso.internal"
    ssh agence "curl -s -o /dev/null -w '%{http_code}\n' --interface 10.10.30.1 http://10.10.20.10"
    ssh agence "nc -zv -w3 -s 10.10.30.1 10.10.10.10 22 2>&1"

**t05-journal-refus.png** : tout de suite après le test refusé. On doit lire IN=wg0, OUT=ens37, SRC=10.10.30.1, DST=10.10.10.10, DPT=22, SYN.
    ssh gw "sudo journalctl -k --since '-2min' | grep gw-forward-drop | tail -1"

**t06-srv-vers-agence.png** : E4. Le siège joint l'agence (1 received, puis « agence »).
    ssh srv "ping -c1 10.10.30.1"
    ssh srv "ssh nael@10.10.30.1 hostname"

**t07-ports-wan-gw.png** : E4, ports vus depuis le WAN (dure environ 15 secondes). 22, 80, 443 open ; 53, 3128, 19999 filtered.
    ssh agence "sudo nmap -Pn -p 22,53,80,443,3128,19999 192.168.125.130"

**t08-regles-numerotees.png** : E5. Les règles F11 à F19 dans le fichier du pare-feu.
    ssh gw "grep -n '\[F1[1-9]\]' /etc/nftables.conf"

**t09-netdata-ecoute.png** : E6. Netdata n'écoute que sur 127.0.0.1.
    ssh srv "sudo ss -tlnp | grep 19999"

**t10-redemarrage-agence.png** : E2, après redémarrage. Lance la première commande, attends 40 secondes, puis les 3 suivantes dans la même capture. Netdata peut afficher une alerte quelques secondes : c'est normal.
    ssh agence "sudo reboot"
    ssh agence "uptime -p"
    ssh agence "systemctl is-enabled wg-quick@wg0"
    ssh agence "sudo wg show"

**t11-redemarrage-gw.png** (facultatif) : pareil pour gw. Attention : pendant environ 40 secondes, plus de SSH vers srv, web et cli. Attends 60 secondes avant les commandes suivantes.
    ssh gw "sudo reboot"
    ssh gw "uptime -p"
    ssh gw "sudo wg show"
    ssh gw "sudo nft list ruleset | grep -c 'policy drop'"

## Netdata (navigateur)
Déjà faites et placées dans le même dossier (`netdata-01-ping.jpg` à `netdata-05-certificat.jpg` et `panne-00` à `panne-06`). Pour ouvrir Netdata toi-même :
    ssh -L 19999:127.0.0.1:19999 srv
puis `http://127.0.0.1:19999` dans le navigateur, « Skip and use the dashboard anonymously », menu de droite Synthetic (Ping, HTTP, Port, DNS, Certificate), onglets Alerts et Events.

## Quand tu as fini
Dis-moi « ok » : j'ajoute tes captures dans le dossier technique et je regénère le PDF.
