import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import { shell } from 'electron'
import path from 'path'

export default class Container extends Component {
    scrollOutputToBottom () {
        const outputContainer = ReactDOM.findDOMNode(this.refs.commandOutput)
        outputContainer.scrollTop = outputContainer.scrollHeight
    }

    render () {
        const itemParameters = this.props.parameters.map((parameter, index) => {
            // File type parameters
            if (parameter.type === 'file') {
                return (
                    <div className='parameter' key={index}>
                        <div className='parameter-name'>{parameter.parameter}</div>
                        <input className={'parameter-input' + (parameter.highlight ? ' highlight' : '')} placeholder='Drag and drop a file here or type a path' value={parameter.value} onChange={this.props.handleDroppableInputChange.bind(null, parameter.id)} onDrop={this.props.handleDroppableInputChange.bind(null, parameter.id)} />
                        <div className='file-select' onClick={this.props.openFileForParameterDialog.bind(null, parameter.id, ['openFile'])}>
                            <i className='lnr lnr-file-add'></i>
                            Select File
                        </div>
                    </div>
                )
            }
            // String type parameters
            if (parameter.type === 'text') {
                return (
                    <div className='parameter' key={index}>
                        <div className='parameter-name'>{parameter.parameter}</div>
                        <input className={'parameter-input'} placeholder={parameter.placeholder} value={parameter.value} onChange={this.props.handleDroppableInputChange.bind(null, parameter.id)} />
                    </div>
                )
            }
        })

        let outputResult
        if (this.props.running === false) {
            if (this.props.status === 'error') {
                outputResult = ' error'
            } else if (this.props.status === 'success') {
                outputResult = ' success'
            } else {
                outputResult = ' idle'
            }
        } else {
            outputResult = ' running'
        }

        // Show output files
        let outputFilesInner
        if (this.props.outputFile.type !== 'none' && this.props.status === 'success') {
            // If there is a parameter specified as an output file, use it's value
            let filePath
            if (this.props.outputFile.type === 'parameter') {
                const parameter = _.find(this.props.parameters, { id: this.props.outputFile.id })
                filePath = parameter.value
            } else if (this.props.outputFile.type === 'path') {
                filePath = this.props.outputFile.path
            }
            
            // Check relative vs absolute path
            if (filePath[0] !== '/') {
                filePath = this.props.workingDirectory + filePath
            }

            filePath = path.normalize(filePath)

            outputFilesInner = (
                <div className='output-files'>
                    <div className='header'>Output files:</div>
                    <div className='output-file' onClick={shell.showItemInFolder.bind(null, filePath)}>{filePath}</div>
                </div>
            )
        }

        return (
            <div className='panel'>
                <div className='header'>{this.props.title}</div>
                <div className='panel-inner'>
                    <div className='working-directory'>
                        <div className='title'>Working Directory</div>
                        <div className='body'>{this.props.workingDirectory}</div>
                    </div>
                    <div className='command-string'>
                        <div className='title'>Command to run</div>
                        <div className='command-string-inner'>{this.props.command.join(' ')}</div>
                    </div>
                    <div className='command-parameters'>
                        <div className='title'>Parameters</div>
                        {itemParameters}
                    </div>
                    <div className='command-actions'>
                        <div className='run' onClick={this.props.runCommand.bind(null, this.props.id)}>
                            <span className="lnr lnr-checkmark-circle"></span>
                            Run
                        </div>
                        <div className='edit' onClick={this.props.toggleEditModeForScript.bind(null, this.props.id)}>
                            <span className="lnr lnr-pencil"></span>
                            Edit Script
                        </div>
                        <div className='export' onClick={this.props.exportScriptToFile.bind(null, this.props.id)}>
                            <span className="lnr lnr-download"></span>
                            Export Script
                        </div>
                    </div>
                    {outputFilesInner}
                    <div className={'command-output' + outputResult} ref="commandOutput">
                        {this.props.output}
                    </div>
                    <div className='stdin-outer'>
                        <input type="text" placeholder="Type here to send input to the program" value={this.props.stdinInputValue} onChange={this.props.handleStdinInputChange.bind(null, this.props.id)} onKeyPress={this.props.handleStdinKeyPress.bind(null, this.props.id)} />
                    </div>
                </div>
            </div>
        )
    }
}