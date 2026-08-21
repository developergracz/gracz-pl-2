# Gracz

Table of contents:
  - Description
  - Installation
  - Usage
  - Contributing
  - Credits
  - License


## Description [PL]
Serwis Gracz udostępnia platformę do gier typu multiplayer.

## Description [ENG]
Gracz webservice is multiplayer gaming platform.


## Installation
More information You can find on Wiki. Installing web service on the fresh VPS server is time consuming work. To speed it up, we prepared server-setup.sh script which will install everything what is needed (docker, tools, firewall etc...)

## Deployment
To deploy something to the production or any other environment (like test or developer's environment), merge Your git branch to git master branch and use Gracz's Jenkins automation tool to deploy the code stroed in Git to production (Jenkin's task named "Deployment" - You can choose there to whichc envirnoment the code should be deployed to).

## Usage
To use the website as a developer, You need to connect through OpenVPN with the server. The .ovpn file should be delivered to You once You start working with the project. The VPN connection gives You access to tools like Jenkins, Docker, Portainer, Smartfox Server Console, Nginx, PHP-FPM.

## Contributing
Please work acordingly to the GitFlow rules. We are creating feature branches, and after, creating PullRequests to merge them into the main branch if there is more than one programmer working on the project. If only one programmer is working on the project, PullRequests are not needed. Otherwise, the second programmer should do a code review of the first programmer's PullRequest.

## Credits
  - Czesław Socha
  - Łukasz Wyporek

## License
Private property of Czesław Socha.
