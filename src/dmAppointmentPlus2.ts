import { MachineConfig, Machine, Action, actions, assign } from "xstate";
import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";
const { send, cancel } = actions;

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

let a = grammar2["yes"];
let b = grammar2["no"];
let count = 0;
const commands = { "stop":"S", "help":"S" };

function promptAndAsk1(prompt: string): MachineConfig<SDSContext, any, SDSEvent> {
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

function promptAndAsk(prompt: Action<SDSContext, SDSEvent>, nomatch: string, help:string) : MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'prompt',
        states:{
            prompt: {
                entry: prompt,
                on: {ENDSPEECH: 'ask'}
            },
            ask: {
                entry: [send('LISTEN'), send('MAXSPEECH', {delay: 4000, id: 'timeout'})],
            },
            nomatch: {
                entry: say(nomatch),
                on: { ENDSPEECH: "prompt" }
            },
            help: {
                entry: say(help),
                on: { ENDSPEECH: 'ask' }
            }
        }})}


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
                    ...promptAndAsk1("What would you like to do? Your options are appointment, to do item or timer")
        },

        query: {
            invoke: {
                id: 'rasa',
                src: (context, event) => nluRequest(context.option),
                onDone: {
                    target: 'menu',
                    actions: [assign((context, event) => { return  {option: event.data.intent.name} }),
                    (context: SDSContext, event: any) => console.log(event.data)]
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
                }
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
        
        maxspeech : {
            entry: say("Sorry I couldn't hear anything"),
            on: {'ENDSPEECH': 'mainappointment.hist'}
        },

        finalmaxspeech: {
            entry: say("It appears you are not there anymore. Goodbye."),
            on: {'ENDSPEECH': 'init'}
        },
        
        appointment: {
            initial: "prompt",
            on: { ENDSPEECH: "mainappointment" },
            states: {
                prompt: { entry: say("Let's create an appointment") }
            }
        },
        
        mainappointment: {
            initial: 'who',
            on: {
                MAXSPEECH: [
                    {cond: (context) => context.counter == 3, target: 'finalmaxspeech'},
                    {target: 'maxspeech', actions: assign((context) => { count++; return { counter: count } })}
                ]
            },

            states: {            
                hist: { type: 'history', history: 'shallow' },

                who: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            { cond: (context) => "person" in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { person: grammar[context.recResult].person } }),
                            target: "day" },
                            { cond: (context) => (context.recResult in commands),
                            target: ".help" },
                            { target: ".nomatch" }
                        ]
                    },
                ...promptAndAsk (say ("Who are you meeting with?"), "Sorry, I don't know them", "You need to tell me which person you will be meeting so that I can set the appointment")
                },    

                day: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            { cond: (context) => 'day' in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { day: grammar[context.recResult].day } }),
                            target: 'wholeday'},
                            { cond: (context) => (context.recResult in commands), target: ".help" },
                            { target: ".nomatch" }                
                        ]
                    },
                    ...promptAndAsk (send((context) => ({ type: "SPEAK", value: `OK ${context.person}. On which day is your meeting?`})), 
                    "Sorry, could you repeat that?", "I am asking what day your meeting will take place so that I can put it on your calendar")
                },

                wholeday: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            { cond: (context) => (grammar2[context.recResult] === b), target: "time" },
                            { cond: (context) => (grammar2[context.recResult] === a), target: "confirmwholeday" },
                            { cond: (context) => (context.recResult in commands), target: ".help" },
                            { target: ".nomatch" }               
                        ]
                    },
                    ...promptAndAsk (send((context) => ({ type: "SPEAK", value: `OK ${context.day}. Will your meeting take the whole day?`})), 
                    "Sorry, could you repeat that?", "I am asking whether your meeting will take the whole day so that I clear your schedule")
                },

                time: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            { cond: (context) => "time" in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { time: grammar[context.recResult].time } }),
                            target: "confirmtime" },
                            { cond: (context) => (context.recResult in commands), target: ".help" },
                            { target: ".nomatch" } 
                        ]
                    },
                    ...promptAndAsk (send((context) => ({ type: "SPEAK", value: `OK ${context.day}. What time is your meeting?`})), 
                    "Sorry, could you repeat that?", "I am asking what time you would like to schedule your meeting")
                },    

                confirmwholeday: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            {cond: (context) => (grammar2[context.recResult] === b), target: "who" },
                            {cond: (context) => (grammar2[context.recResult] === a), target: "confirmed" },
                            { cond: (context) => (context.recResult in commands), target: ".help" },
                            { target: ".nomatch" } 
                        ]
                    },
                    ...promptAndAsk (send((context) => ({ type: "SPEAK", value: `OK. Do you want to create an appointment with ${context.person} on ${context.day} for the whole day?`})), 
                    "Sorry, could you repeat that?", "I am asking if you confirm the appointment I have created so I can put it on your schedule")
                },   

                confirmtime: {
                    initial: "prompt",
                    on:  {
                        RECOGNISED: [
                            {cond: (context) => (grammar2[context.recResult] === b), target: "who" },
                            {cond: (context) => (grammar2[context.recResult] === a), target: "confirmed" },
                            { cond: (context) => (context.recResult in commands), target: ".help" },
                            { target: ".nomatch" }                         
                        ]
                    },
                    ...promptAndAsk (send((context) => ({ type: "SPEAK", value: `OK. Do you want to create an appointment with ${context.person} on ${context.day} at ${context.time}?`})), 
                    "Sorry, could you repeat that?", "I am asking if you confirm the appointment I have created so I can put it on your schedule")
                },  

                confirmed: {
                    initial: "prompt",
                    states: {
                        prompt: {
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: `Your appointment has been created!` }))
                        },
                    }
                }                 
    } //states 2 closes
    }, //MainAppointment closes   
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

