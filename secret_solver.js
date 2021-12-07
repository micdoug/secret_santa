import { Contact, Friendship, database } from "./database.js";
// import { client } from "./whatsapp_client.js";

const kStateRegistered = 3; // In this state the contact is considered registered with confirmed name.


// Shuffle the items of an array in place.
// This function implements the Durstenfeld shuffle algorithm.
function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // generating random number between 0 and i
        const temp = items[j];
        items[j] = items[i];
        items[i] = temp;
    }
}

// Extracts the whatsapp id from the contact record.
// Some contacts have a prefix in the whatsapp id, to make it possible to share
// the same phone number for multiple contacts. This function basically removes
// this prefix when it is present.
function getWhatsappId(contact) {
    if (!contact.id.startsWith("#")) {
        return contact.id;
    }
    return contact.id.substr(contact.id.lastIndexOf("#") + 1);
}

// Checks if the list of friends contains all elements that are in the contacts list.
function checkAllContactsArePresent(contacts, friends) {
    if (contacts.length != friends.length) {
        console.log("Length mismatch between friends list and contacts list.");
        return false;
    }
    const friendsSet = new Set(friends.map((friend) => friend.id));
    const diffSet = new Set();
    for (let contact of contacts) {
        if (!friendsSet.has(contact.id)) {
            diffSet.add(contact);
        }
    }
    if (diffSet.size != 0) {
        console.log("Failed when checking if all contacts are present in the friends list.");
        for (let contact of diffSet) {
            console.log(`Missing "${contact.id}".`);
        }
        return false;
    }
    return true;
}

// Checks if there are no contact with a friend that is registered in the same Whatsapp id.
// This also prevents a contact from being associated with itself.
function checkNoFriendsInTheSameWhatsappId(contacts, friends) {
    if (contacts.length != friends.length) {
        console.log("Length mismatch between contacts and friends.");
        return false;
    }
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const friend = friends[i];
        if (getWhatsappId(contact) === getWhatsappId(friend)) {
            console.log(`Whatsapp id conflict between ${contact.id} and ${friend.id}.`);
            return false;
        }
    }
    return true;
}


// Generates the friends list considering the following constraints:
// - A contact can't be friend with itself.
// - A contact can't be friend with a contact registered in the same whatsapp account.
// - All contacts must be friend with one and only one contact.
function generateFriendsList(contacts) {
    while (true) {
        const friends = contacts.slice();
        shuffle(friends);
        if (checkAllContactsArePresent(contacts, friends) && checkNoFriendsInTheSameWhatsappId(contacts, friends)) {
            return friends;
        }
    }
}

// Persists the association between contacts and friends in the database.
// This is useful if there are problems when sending notifications, so we can
// recover the friendship from the database and send the notification again.
async function persistFriendship(contacts, friends) {
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const friend = friends[i];
        const friendship = { contactId: contact.id, friendId: friend.id, notified: false, };
        await Friendship.create(friendship);
    }
}

// Load records from friendships table in the database and send notifications
// in whatsapp.
async function notifyFriendshipByWhatsApp() {
    const friendships = await Friendship.findAll();
    for (let friendship of friendships) {
        const contact = await Contact.findByPk(friendship.contactId);
        const friend = await Contact.findByPk(friendship.friendId);
        if (friendship.notified) {
            console.log(`Skipping ${contact.name}, because they were already notified.`);
            continue;
        }
        console.log(`Sending notification to ${contact.name}`);
        // const whatsappId = getWhatsappId(contact);
        // await client.sendText(whatsappId, `Olá ${contact.name}! O sorteio do amigo oculto foi realizado. Você saiu com ${friend.name}.`);
        // console.log(`Olá ${contact.name}! O sorteio do amigo oculto foi realizado. Você saiu com *${friend.name}*.`);
        friendship.notified = true;
        await friendship.save();
    }
}

const contacts = await Contact.findAll({ where: { state: kStateRegistered }, order: [["name", "ASC"]] });
const friends = generateFriendsList(contacts);
await persistFriendship(contacts, friends);
await notifyFriendshipByWhatsApp();

