import { MachineConfig, Machine, send, Action, assign } from "xstate";
import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}

const grammar: { [index: string]: { person?: string, day?: string, time?: string } 
} = {
    "John": { person: "John Appleseed" },
    "Mary": { person: "Mary Curie" },
    "George": { person: "George Smith" },
    "Axel": { person: "Axel Rose" },
    "Sebastian": { person: "Sebastian Bach" },

    "on Monday": { day: "Monday" },
    "on Tuesday": { day: "Tuesday" },
    "on Wednesday": { day: "Wednesday" },
    "on Thursday": { day: "Thursday" },
    "on Friday": { day: "Friday" },
	"on Saturday": { day: "Saturday" },
	"on Sunday": { day: "Sunday" },

	"at 5": { time: "5:00" },
	"at 6": { time: "6:00" },
    "at 7": { time: "7:00" },
    "at 8": { time: "8:00" },
    "at 9": { time: "9:00" },
    "at 10": { time: "10:00" },
    "at 11": { time: "11:00" },
    "at 12": { time: "12:00" }
}

const grammar2: { [index: string]: boolean } = {
    "yes of course": true,
    "sure": true,
    "absolutely": true,
    "yes": true,
    "no way": false,
    "no": false
}

let a = grammar2["yes"]
let b = grammar2["no"]

function promptAndAsk(prompt: string): MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'prompt',
        states: {
            prompt: {
                entry: say(prompt),
                on: { ENDSPEECH: 'ask' }
            },
            ask: {
                entry: send('LISTEN')
            },
        }})
}


export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
   
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }            
        },        

        welcome: {
            on: {
                RECOGNISED: {
                    target: "query",
                    actions: assign((context) => { return { option: context.recResult } }),
                }    
            },
                    ...promptAndAsk("What would you like to do? Your options are appointment, to do item or timer")
        },


        query: {
            invoke: {
                id: 'rasa',
                src: (context, event) => nluRequest(context.option),
                onDone: {
                    target: 'menu',
                    actions: [assign((context, event) => { return  {option: event.data.intent.name} }),
                    (context: SDSContext, event: any) => console.log(event.data)]
                    //actions: assign({ intent: (context: SDSContext, event: any) =>{ return event.data }})

                },
                onError: {
                    target: 'welcome',
                    actions: (context, event) => console.log(event.data)
                }
            }
        },

        menu: {
            initial: "prompt",
            on: {
                ENDSPEECH: [
                    { target: 'todo', cond: (context) => context.option === 'todo' },
                    { target: 'timer', cond: (context) => context.option === 'timer' },
                    { target: 'appointment', cond: (context) => context.option === 'appointment' }
                ]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. I understand.`
                    })),
        },
     /*            nomatch: {
                    entry: say("Sorry, I don't understand"),
                    on: { ENDSPEECH: "prompt" }
        } */ 
            }       
        },


        todo: {
            initial: "prompt",
            on: { ENDSPEECH: "init" },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Let's create a to do item`
                    }))
                }}
        },
        
        timer: {
            initial: "prompt",
            on: { ENDSPEECH: "init" },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Let's create a timer`
                    }))
                }}
        },
        
        
        appointment: {
            initial: "prompt",
            on: { ENDSPEECH: "who" },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Let's create an appointment`
                    }))
                }}
        },
        who: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
					cond: (context) => "person" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { person: grammar[context.recResult].person } }),
                    target: "day"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: say("Who are you meeting with?"),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry I don't know them"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        day: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "day" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { day: grammar[context.recResult].day } }),
                    target: "wholeday"
                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.person}. On which day is your meeting?`,
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry I didn't understand"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        wholeday: {
            initial: "prompt",
            on: {
                RECOGNISED: [{cond: (context) => (grammar2[context.recResult] === b),
                    target: "time"
                },
		{cond: (context) => (grammar2[context.recResult] === a),
		target: "confirm_meeting_whole_day"
		},
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.person} on ${context.day}. Will it take the whole day?`
                    })),
		    on: { ENDSPEECH: "ask" }
                },
		ask: {
		     entry: listen()
            },
	    nomatch: {
	    	entry: say("Sorry, I don't understand"),
		on: { ENDSPEECH: "prompt" }
	            }
                }
	},
        time: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "time" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { time: grammar[context.recResult].time } }),
                    target: "confirm_time"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.day}. What time is your meeting?`,
                    
                    })),
            on: { ENDSPEECH: "ask" }
                },
        ask: {
            entry: listen()
                },
        nomatch: {
            entry: say("Sorry I don't know that"),
        on: { ENDSPEECH: "prompt" }
                }
                }
        },
        confirm_meeting_whole_day: {
            initial: "prompt",
            on: {
                RECOGNISED: [{cond: (context) => (grammar2[context.recResult] === b),
                    target: "init"
                },
		{cond: (context) => (grammar2[context.recResult] === a),
		target: "confirmed"
		},
                { target: ".nomatch" }]
            },

            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Do you want to create an appointment with ${context.person} on ${context.day} for the whole day?`
                    })),
		    on: { ENDSPEECH: "ask" }
                },
		ask: {
		     entry: listen()
            },
	    nomatch: {
	    	entry: say("Sorry, I don't understand"),
		on: { ENDSPEECH: "prompt" }
	           }
                }

	},
    confirm_time: {
        initial: "prompt",
        on:  {
            RECOGNISED: [{cond: (context) => (grammar2[context.recResult] === b),
                target: "who"
            },
    {cond: (context) => (grammar2[context.recResult] === a),
    target: "confirmed"
    },
            { target: ".nomatch" }]
        },
        states: {
            prompt: {
               entry: send((context) => ({
                    type: "SPEAK",
                    value: `Do you want to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
                })),
        on: { ENDSPEECH: "ask" }
            },
    ask: {
         entry: listen()
        },
    nomatch: {
        entry: say("Sorry, I don't understand"),
    on: { ENDSPEECH: "prompt" }
           }
            },
        },
    confirmed: {
        initial: "prompt",
        on: { ENDSPEECH: "init" },
        states: {
            prompt: {
                entry: send((context) => ({
                    type: "SPEAK",
                    value: `Your appointment has been created!`
                }))
            },
    }
    }
    }})




/* RASA API
 *  */
const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = 'https://irenetsk.herokuapp.com/model/parse'
const nluRequest = (text: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        headers: { 'Origin': 'http://localhost:3000/react-xstate-colourchanger' }, // only required with proxy
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());


